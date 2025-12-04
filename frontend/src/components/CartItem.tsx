import React from 'react';
import type { OrderItem } from '../store/useKioskStore';

interface CartItemProps {
  item: OrderItem;
}

const CartItem: React.FC<CartItemProps> = ({ item }) => {
  return (
    <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl hover:bg-gray-100 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-900">{item.name}</h3>
        <span className="font-semibold text-gray-900">${item.finalPrice.toFixed(2)}</span>
      </div>
      {item.modifiers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.modifiers.map((mod, idx) => (
            <span 
              key={idx} 
              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-200"
            >
              {mod}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CartItem;
