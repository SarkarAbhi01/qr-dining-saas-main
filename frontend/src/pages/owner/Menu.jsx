import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Leaf, Drumstick, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';

import { restaurantApi } from '@/api/restaurant';
import Modal from '@/components/Modal';
import MenuItemModal from '@/components/MenuItemModal';

const TYPE_ICON = { VEG: Leaf, VEGAN: Leaf, NON_VEG: Drumstick, EGG: Drumstick };
const TYPE_COLOR = { VEG: 'text-basil', VEGAN: 'text-basil', NON_VEG: 'text-chili', EGG: 'text-saffron-dark' };

export default function Menu() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  async function loadCategories() {
    const cats = await restaurantApi.listCategories();
    setCategories(cats);
    if (!activeCategory && cats.length) setActiveCategory(cats[0].id);
    return cats;
  }

  async function loadItems() {
    setItems(await restaurantApi.listMenuItems());
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadCategories(), loadItems()])
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load menu'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateCategory(e) {
    e.preventDefault();
    try {
      await restaurantApi.createCategory({ name: newCatName, sequence: categories.length });
      toast.success('Category added');
      setNewCatName('');
      setCatModalOpen(false);
      loadCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add category');
    }
  }

  async function handleDeleteCategory(id) {
    if (!confirm('Delete this category? Items inside it will also be deleted.')) return;
    try {
      await restaurantApi.deleteCategory(id);
      toast.success('Category deleted');
      loadCategories();
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    }
  }

  async function moveCategory(index, direction) {
    const next = [...categories];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setCategories(next);
    try {
      await restaurantApi.reorderCategories(next.map((c) => c.id));
    } catch (err) {
      toast.error('Failed to reorder');
      loadCategories();
    }
  }

  async function handleToggleAvailability(item) {
    try {
      await restaurantApi.toggleAvailability(item.id, !item.isAvailable);
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i)));
    } catch (err) {
      toast.error('Failed to update availability');
    }
  }

  async function handleDeleteItem(id) {
    if (!confirm('Delete this menu item?')) return;
    try {
      await restaurantApi.deleteMenuItem(id);
      toast.success('Item deleted');
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete item');
    }
  }

  const visibleItems = items.filter((i) => i.categoryId === activeCategory);

  if (loading) return <div className="p-6 text-sm text-slate">Loading menu…</div>;

  return (
    <div className="p-4 md:p-6 flex gap-6 max-w-6xl">
      {/* --- Categories --- */}
      <div className="w-56 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-ink">Categories</h2>
          <button onClick={() => setCatModalOpen(true)} className="text-cobalt hover:opacity-70">
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-1">
          {categories.map((c, i) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded px-2 py-1.5 cursor-pointer text-sm ${
                activeCategory === c.id ? 'staff-menu-active' : 'hover:bg-paper-dim text-ink'
              }`}
              onClick={() => setActiveCategory(c.id)}
            >
              <span className="flex-1 truncate">{c.name}</span>
              <span className={`text-xs ${activeCategory === c.id ? 'text-paper/70' : 'text-slate'}`}>
                {c._count?.menuItems ?? 0}
              </span>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button onClick={(e) => { e.stopPropagation(); moveCategory(i, -1); }}>
                  <ArrowUp size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); moveCategory(i, 1); }}>
                  <ArrowDown size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(c.id); }}>
                  <Trash2 size={12} className="text-chili" />
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-xs text-slate">No categories yet — add one to get started.</p>
          )}
        </div>
      </div>

      {/* --- Items --- */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-ink">
            {categories.find((c) => c.id === activeCategory)?.name || 'Items'}
          </h2>
          <button
            onClick={() => { setEditingItem(null); setItemModalOpen(true); }}
            disabled={!categories.length}
            className="staff-menu-btn flex items-center gap-1.5 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Plus size={16} /> Add item
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {visibleItems.map((item) => {
            const TypeIcon = TYPE_ICON[item.type] || Leaf;
            return (
              <div key={item.id} className="ticket-edge bg-white border border-line rounded-ticket p-4 mt-2 flex gap-3">
                <div className="w-16 h-16 rounded bg-paper-dim shrink-0 overflow-hidden flex items-center justify-center">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <TypeIcon size={20} className={TYPE_COLOR[item.type]} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-ink truncate flex items-center gap-1.5">
                      <TypeIcon size={12} className={TYPE_COLOR[item.type]} />
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => { setEditingItem(item); setItemModalOpen(true); }}>
                        <Pencil size={13} className="text-slate hover:text-ink" />
                      </button>
                      <button onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 size={13} className="text-slate hover:text-chili" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate line-clamp-1">{item.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="font-mono text-sm text-ink">
                      {item.hasHalfFull ? (
                        <>₹{Number(item.halfPrice).toLocaleString()} / ₹{Number(item.price).toLocaleString()}
                          <span className="text-[10px] text-slate ml-1">(H/F)</span>
                        </>
                      ) : (
                        `₹${Number(item.price).toLocaleString()}`
                      )}
                    </p>
                    <button
                      onClick={() => handleToggleAvailability(item)}
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        item.isAvailable ? 'bg-basil-soft text-basil' : 'bg-chili-soft text-chili'
                      }`}
                    >
                      {item.isAvailable ? 'Available' : '86\'d'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {visibleItems.length === 0 && categories.length > 0 && (
            <p className="text-sm text-slate col-span-2">No items in this category yet.</p>
          )}
        </div>
      </div>

      {/* --- New category modal --- */}
      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title="New category">
        <form onSubmit={handleCreateCategory} className="space-y-3">
          <input
            required
            autoFocus
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="e.g. Starters, Mains, Desserts"
            className="w-full border border-line rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="staff-menu-btn w-full rounded px-3 py-2.5 text-sm font-medium">
            Add category
          </button>
        </form>
      </Modal>

      <MenuItemModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        categories={categories}
        editingItem={editingItem}
        onSaved={loadItems}
      />
    </div>
  );
}
