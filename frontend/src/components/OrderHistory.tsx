import { X, Clock } from 'lucide-react';
import type { CompletedOrder } from '../store/useKioskStore';

interface OrderHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  orders: CompletedOrder[];
}

const OrderHistory = ({ isOpen, onClose, orders }: OrderHistoryProps) => {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slider Panel */}
      <div className={`fixed right-0 top-0 h-full w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Clock className="text-gray-700" size={24} />
            <h2 className="text-2xl font-normal text-gray-900">Order History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Orders List */}
        <div className="overflow-y-auto h-[calc(100%-80px)] p-6">
          {orders.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-center">No order history yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...orders].reverse().map((order) => (
                <div 
                  key={order.id} 
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                >
                  {/* Order Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        {formatDate(order.timestamp)}
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className="text-lg font-medium text-gray-900">
                      ${order.total.toFixed(2)}
                    </p>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="text-sm">
                        <p className="font-medium text-gray-700">{item.name}</p>
                        {item.modifiers.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {item.modifiers.join(', ')}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          ${item.finalPrice.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Order Totals */}
                  <div className="mt-3 pt-3 border-t border-gray-300 space-y-1 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>${order.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Tax (HST 13%)</span>
                      <span>${order.tax.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default OrderHistory;
