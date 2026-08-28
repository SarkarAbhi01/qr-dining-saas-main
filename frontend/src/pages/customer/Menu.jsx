import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Drumstick, Plus, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';

import { customerApi } from '@/api/customer';
import { useCartStore, cartTotal, cartItemCount } from '@/store/cartStore';
import { useCustomerContext } from './CustomerApp';
import ItemModal from '@/components/customer/ItemModal';

const TYPE_ICON = { VEG: Leaf, VEGAN: Leaf, NON_VEG: Drumstick, EGG: Drumstick };
const TYPE_COLOR = { VEG: 'text-basil', VEGAN: 'text-basil', NON_VEG: 'text-chili', EGG: 'text-saffron-dark' };

export default function Menu() {
  const { restaurant } = useCustomerContext();
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalItem, setModalItem] = useState(null);
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    customerApi
      .getMenu(restaurant.slug)
      .then((data) => {
        setCategories(data.categories);
        if (data.categories.length) setActiveCategory(data.categories[0].id);
      })
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.slug]);

  function quickAdd(item) {
    if (item.modifierGroups?.length || item.hasHalfFull) {
      setModalItem(item);
      return;
    }
    addItem({ menuItemId: item.id, name: item.name, unitPrice: Number(item.price), quantity: 1, portion: 'FULL', notes: '', modifierOptionIds: [] });
    toast.success(`${item.name} added`);
  }

  if (loading) return <p className="p-6 text-sm text-slate">Loading menu…</p>;

  const activeItems = categories.find((c) => c.id === activeCategory)?.menuItems || [];
  const total = cartTotal(items);
  const count = cartItemCount(items);

  return (
    <div className="pb-24">
      {/* Category tabs */}
      <div
        className="sticky top-[57px] z-10 border-b border-line px-4 py-2 flex gap-2 overflow-x-auto"
        style={{ backgroundColor: 'var(--customer-body)' }}
      >
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`shrink-0 text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
              activeCategory === c.id ? 'customer-menu-chip-active' : 'bg-white border border-line text-ink'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {activeItems.map((item) => {
          const TypeIcon = TYPE_ICON[item.type] || Leaf;
          return (
            <div key={item.id} className="ticket-edge bg-white border border-line rounded-ticket p-3 mt-2 flex gap-3">
              <div className="w-20 h-20 rounded bg-paper-dim shrink-0 overflow-hidden flex items-center justify-center">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <TypeIcon size={22} className={TYPE_COLOR[item.type]} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                  <TypeIcon size={12} className={TYPE_COLOR[item.type]} />
                  {item.name}
                </p>
                {item.description && <p className="text-xs text-slate line-clamp-2 mt-0.5">{item.description}</p>}
                <div className="flex items-center justify-between mt-2">
                  {item.hasHalfFull ? (
                    <p className="font-mono text-xs text-ink leading-tight">
                      Half ₹{Number(item.halfPrice).toLocaleString()}
                      <br />
                      Full ₹{Number(item.price).toLocaleString()}
                    </p>
                  ) : (
                    <p className="font-mono text-sm text-ink">₹{Number(item.price).toLocaleString()}</p>
                  )}
                  <button
                    onClick={() => quickAdd(item)}
                    className="customer-menu-btn flex items-center gap-1 text-xs font-medium rounded-full px-3 py-1.5"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {activeItems.length === 0 && <p className="text-sm text-slate">Nothing available here right now.</p>}
      </div>

      {count > 0 && (
        <Link
          to="cart"
          className="customer-menu-btn fixed bottom-4 inset-x-4 rounded-ticket shadow-lg px-5 py-3.5 flex items-center justify-between"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <ShoppingBag size={16} /> {count} item{count > 1 ? 's' : ''}
          </span>
          <span className="font-mono text-sm">View cart · ₹{total.toFixed(2)}</span>
        </Link>
      )}

      <ItemModal open={!!modalItem} onClose={() => setModalItem(null)} item={modalItem} />
    </div>
  );
}
