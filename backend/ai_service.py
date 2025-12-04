import os
import json
from typing import Dict, Any, Optional
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class AIService:
    def __init__(self):
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
        
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY not found in .env file")
        
        # Configure Gemini
        genai.configure(api_key=self.gemini_api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash-lite')
        self.chat = None
        
        # Load menu
        menu_path = os.path.join(os.path.dirname(__file__), "menu.json")
        with open(menu_path, "r") as f:
            self.menu_data = json.load(f)
    
    def start_conversation(self, menu_data: Dict[str, Any]) -> None:
        """Start a new conversation with the AI"""
        system_prompt = f"""You are an AI assistant for a Tim Hortons kiosk. Your job is to help customers order items.

MENU:
{json.dumps(menu_data, indent=2)}

TIM HORTONS KEYWORDS & SLANG:
- "double double" = coffee with 2 cream and 2 sugar
- "triple triple" = coffee with 3 cream and 3 sugar
- "regular" = 1 cream, 1 sugar
- "black" = no cream, no sugar
- "Timmies" = Tim Hortons
- Sizes: Small, Medium, Large, Extra Large (XL)

RULES:
1. **CRITICAL**: When the customer adds, removes, or modifies an item, you MUST output a JSON block FIRST, followed by your natural response.
2. **JSON FORMAT**:
   - Add Item: {{"action": "add_to_cart", "item_id": "...", "name": "...", "modifiers": [...], "price": ...}}
   - Remove Item: {{"action": "remove_item", "item_id": "..."}}
   - Clear Cart: {{"action": "clear_cart"}}
   - Finalize Order: {{"action": "finalize_order"}}
3. ALWAYS output JSON FIRST, then your text response.
4. Keep responses SHORT (1-2 sentences max).
5. Recognize keywords: "double double" (2 cream 2 sugar), "regular" (1 cream 1 sugar), "Timmies".
6. If the order is ambiguous, ask clarifying questions (size, etc.) BEFORE adding to cart.
7. DO NOT explain the JSON. Just output it.
8. **TAX RULE**: Prices in the menu are pre-tax. HST is 13%. When stating the total, you MUST calculate (Subtotal * 1.13) and round to 2 decimal places. Say "Your total with tax is $X.XX".
9. **FINALIZE ORDER**: When the user says "that's it", "I'm done", "that's all", or similar completion phrases, output {{"action": "finalize_order"}} to trigger automatic checkout.

EXAMPLES:
User: "I want a double double"
You: "What size would you like for that coffee?"

User: "Medium please"
You: {{"action": "add_to_cart", "item_id": "coffee_original", "name": "Original Blend Coffee", "modifiers": ["Medium", "2 Cream", "2 Sugar"], "price": 1.79}}
    "Got it! A medium double double. Anything else?"

User: "That's it"
You: {{"action": "finalize_order"}}
    "Great! Your total with tax is $2.02. Thank you!"

Remember: Keep it SHORT and NATURAL. Don't explain the JSON, just include it in your response."""

        self.chat = self.model.start_chat(history=[])
        # Send system prompt as first message
        self.chat.send_message(system_prompt)
    
    def reset_conversation(self) -> None:
        """Reset the conversation to start fresh"""
        print("Resetting AI conversation...")
        self.chat = None
    
    async def process_user_message(self, user_text: str, current_cart: list) -> Dict[str, Any]:
        
        if not self.chat:
            self.start_conversation(self.menu_data)
        
        # Add cart context to the message
        cart_context = f"\n\nCurrent cart: {json.dumps(current_cart)}" if current_cart else "\n\nCart is empty"
        full_message = user_text + cart_context
        
        try:
            # Get AI response
            response = self.chat.send_message(full_message)
            ai_text = response.text
            
            # Parse response for actions
            result = {
                "text": ai_text,
                "actions": []
            }
            
            import re
            
            # Find all JSON-like blocks
            # This regex looks for { ... } non-greedily
            # It might be fragile with nested braces but sufficient for this specific AI output format
            json_matches = re.finditer(r'\{[^{}]*\}', ai_text)
            
            clean_text = ai_text
            
            for match in json_matches:
                json_str = match.group()
                try:
                    action_data = json.loads(json_str)
                    if "action" in action_data:
                        result["actions"].append(action_data)
                        # Remove this block from text
                        clean_text = clean_text.replace(json_str, "")
                except json.JSONDecodeError:
                    continue
            
            # Clean up the text
            clean_text = clean_text.strip()
            # Remove leftover double spaces or newlines
            clean_text = re.sub(r'\n\s*\n', '\n', clean_text)
            clean_text = re.sub(r'\s+', ' ', clean_text)
            
            if clean_text:
                result["text"] = clean_text
            else:
                result["text"] = "Got it!"
            
            return result
            
        except Exception as e:
            print(f"Gemini API Error: {e}")
            # TODO: Fallback to DeepSeek if needed
            return {
                "text": "I'm having trouble processing that. Could you try again?",
                "action": None,
                "data": None
            }

# Global AI service instance
ai_service = None

def get_ai_service() -> AIService:
    global ai_service
    if ai_service is None:
        ai_service = AIService()
    return ai_service
