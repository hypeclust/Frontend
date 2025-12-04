
import RPi.GPIO as GPIO
import time
from RPLCD.i2c import CharLCD

# ===========================
# GPIO SETUP
# ===========================
GPIO.setmode(GPIO.BCM)

# Ultrasonic pins
TRIG = 23
ECHO = 24
GPIO.setup(TRIG, GPIO.OUT)
GPIO.setup(ECHO, GPIO.IN)

# LED pins
LED_RED = 17
LED_YELLOW = 27
LED_GREEN = 22
GPIO.setup(LED_RED, GPIO.OUT)
GPIO.setup(LED_YELLOW, GPIO.OUT)
GPIO.setup(LED_GREEN, GPIO.OUT)

# ===========================
# KEYPAD SETUP
# ===========================
KEYPAD_ROWS = [12, 16, 20, 21]      # R1..R4  -> phys 32,36,38,40
KEYPAD_COLS = [5, 6, 13, 19]        # C1..C4  -> phys 29,31,33,35

# Rows as outputs, idle HIGH
for r in KEYPAD_ROWS:
    GPIO.setup(r, GPIO.OUT)
    GPIO.output(r, GPIO.HIGH)

# Cols as inputs with pull‑up (idle HIGH, pressed -> LOW)
for c in KEYPAD_COLS:
    GPIO.setup(c, GPIO.IN, pull_up_down=GPIO.PUD_UP)

KEYPAD_MAP = [
    ["1", "2", "3", "A"],
    ["4", "5", "6", "B"],
    ["7", "8", "9", "C"],
    ["*", "0", "#", "D"]
]

# ===========================
# LCD SETUP (20x4 DISPLAY)
# ===========================
lcd = CharLCD('PCF8574', 0x27, cols=20, rows=4)

# ===========================
# FUNCTIONS
# ===========================
def lcd_clear():
    lcd.clear()

def lcd_write(lines):
    """
    lines = ["line1", "line2", ...]
    """
    lcd_clear()
    for i, text in enumerate(lines):
        lcd.cursor_pos = (i, 0)
        lcd.write_string(text[:20])  # max 20 chars


def leds_only(red=False, yellow=False, green=False):
    GPIO.output(LED_RED, GPIO.HIGH if red else GPIO.LOW)
    GPIO.output(LED_YELLOW, GPIO.HIGH if yellow else GPIO.LOW)
    GPIO.output(LED_GREEN, GPIO.HIGH if green else GPIO.LOW)


def get_key():
    """Scan keypad and return key character, else None."""
    for r in range(4):
        # Drive this row LOW, others HIGH
        for rr in range(4):
            GPIO.output(KEYPAD_ROWS[rr], GPIO.HIGH)
        GPIO.output(KEYPAD_ROWS[r], GPIO.LOW)

        for c in range(4):
            # Active‑low: pressed key pulls column LOW
            if GPIO.input(KEYPAD_COLS[c]) == GPIO.LOW:
                # simple debounce
                time.sleep(0.02)
                if GPIO.input(KEYPAD_COLS[c]) == GPIO.LOW:
                    # wait for release
                    while GPIO.input(KEYPAD_COLS[c]) == GPIO.LOW:
                        time.sleep(0.01)
                    # restore this row
                    GPIO.output(KEYPAD_ROWS[r], GPIO.HIGH)
                    return KEYPAD_MAP[r][c]

        # restore this row
        GPIO.output(KEYPAD_ROWS[r], GPIO.HIGH)

    return None


def get_distance():
    GPIO.output(TRIG, False)
    time.sleep(0.00005)

    # Trigger pulse
    GPIO.output(TRIG, True)
    time.sleep(0.00001)
    GPIO.output(TRIG, False)

    start_time = time.time()
    timeout = start_time + 0.03

    # Wait for echo HIGH
    while GPIO.input(ECHO) == 0:
        pulse_start = time.time()
        if pulse_start > timeout:
            return None

    # Wait for echo LOW
    timeout = time.time() + 0.03
    while GPIO.input(ECHO) == 1:
        pulse_end = time.time()
        if pulse_end > timeout:
            return None

    pulse_duration = pulse_end - pulse_start
    distance = (pulse_duration * 34300) / 2
    return round(distance, 2)


# ===========================
# MAIN LOOP
# ===========================
try:
    print("System Started.")
    leds_only(red=True)
    ai_enable_flag = 0

    while True:
        dist = get_distance()

        # LED logic
        if dist is None:
            leds_only(red=True)
            ai_enable_flag = 0

        elif dist < 5:
            leds_only(green=True)
            ai_enable_flag = 1  # Car present → AI mode ON

        elif 5 <= dist <= 15:
            leds_only(yellow=True)

        else:
            leds_only(red=True)
            ai_enable_flag = 0  # Car moved away

        # ================================
        # AI MODE WORKFLOW STARTS HERE
        # ================================
        if ai_enable_flag == 1:

            print("Car detected. Waiting 5 seconds...")
            time.sleep(5)

            # Display welcome screen
            lcd_write([
                "Hi, User",
                "Welcome to McDonalds",
                "Total Amount: $25.65",
                "Proceed to pay"
            ])

            # Wait for user to press D
            print("Waiting for user to press D...")
            while True:
                key = get_key()
                if key == "D":
                    break
                time.sleep(0.02)

            # Ask for PIN
            lcd_write([
                "Enter PIN",
                "",
                "",
                ""
            ])

            entered_pin = ""

            # Enter digits + press A to confirm
            while True:
                key = get_key()
                if key is None:
                    continue

                if key.isdigit():
                    if len(entered_pin) < 4:
                        entered_pin += key
                        lcd_write([
                            "Enter PIN",
                            "*" * len(entered_pin),
                            "",
                            ""
                        ])

                if key == "A":  # Confirm
                    break

            # Validate PIN
            if entered_pin == "1234":
                lcd_write([
                    "Payment Received",
                    "Thank You",
                    "Move to next window",
                    ""
                ])
            else:
                lcd_write([
                    "Invalid PIN!",
                    "Transaction canceled",
                    "",
                    ""
                ])

            time.sleep(5)
            lcd_clear()

            # Reset to main loop
            ai_enable_flag = 0
            leds_only(red=True)

        time.sleep(0.2)

except KeyboardInterrupt:
    print("\nStopping system...")

finally:
    lcd_clear()
    leds_only(False, False, False)
    GPIO.cleanup()
    print("GPIO cleaned up. System stopped.")