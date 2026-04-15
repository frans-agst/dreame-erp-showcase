-- OmniERP Products Seed Data
-- Generic sample products for development and demo purposes.
-- All SKUs, names, and prices are fictional placeholders.

DELETE FROM stock_opname_items;
DELETE FROM stock_opname;
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;
DELETE FROM sales;
DELETE FROM inventory;
DELETE FROM products;

INSERT INTO products (sku, name, category, sub_category, channel_pricing, price_retail, is_active)
VALUES
-- ==================== Main Units ====================
('PRD-MU-001', 'ProClean X1',        'Main Unit', 'Wet & Dry',     '{"brandstore": 3500000}', 3500000, true),
('PRD-MU-002', 'ProClean X1 Pro',    'Main Unit', 'Wet & Dry',     '{"brandstore": 5000000}', 5000000, true),
('PRD-MU-003', 'ProClean X1 Ultra',  'Main Unit', 'Wet & Dry',     '{"brandstore": 8500000}', 8500000, true),
('PRD-MU-004', 'RoboSweep R1',       'Main Unit', 'Robovac',       '{"brandstore": 3200000}', 3200000, true),
('PRD-MU-005', 'RoboSweep R1 Pro',   'Main Unit', 'Robovac',       '{"brandstore": 5500000}', 5500000, true),
('PRD-MU-006', 'RoboSweep R1 Ultra', 'Main Unit', 'Robovac',       '{"brandstore": 9000000}', 9000000, true),
('PRD-MU-007', 'SlimVac S1',         'Main Unit', 'Stick Vacuum',  '{"brandstore": 3000000}', 3000000, true),
('PRD-MU-008', 'SlimVac S1 Pro',     'Main Unit', 'Stick Vacuum',  '{"brandstore": 4500000}', 4500000, true),
('PRD-MU-009', 'AirStyle A1',        'Main Unit', 'Beauty',        '{"brandstore": 1200000}', 1200000, true),
('PRD-MU-010', 'AirStyle A1 Pro',    'Main Unit', 'Beauty',        '{"brandstore": 1600000}', 1600000, true),
('PRD-MU-011', 'MiteGuard M1',       'Main Unit', 'Mite Removal',  '{"brandstore": 1700000}', 1700000, true),
('PRD-MU-012', 'PureAir P1',         'Main Unit', 'Purifier',      '{"brandstore": 12000000}', 12000000, true),
('PRD-MU-013', 'SteamClean N1',      'Main Unit', 'Steam Cleaner', '{"brandstore": 3600000}', 3600000, true),

-- ==================== Accessories ====================
('PRD-AC-001', 'Main Brush Set',          'Accessory', 'Accessory', '{}', 0,      true),
('PRD-AC-002', 'Dust Box Filter',         'Accessory', 'Accessory', '{}', 0,      true),
('PRD-AC-003', 'Accessories Kit Standard','Accessory', 'Accessory', '{}', 0,      true),
('PRD-AC-004', 'Mop Pad Set',             'Accessory', 'Accessory', '{}', 0,      true),
('PRD-AC-005', 'Rolling Brush',           'Accessory', 'Accessory', '{}', 0,      true),
('PRD-AC-006', 'Side Brush Pack',         'Accessory', 'Accessory', '{}', 0,      true),
('PRD-AC-007', 'Floor Cleaner 500ml',     'Accessory', 'Accessory', '{"brandstore": 169000}', 169000, true),
('PRD-AC-008', 'Floor Cleaner 1L',        'Accessory', 'Accessory', '{"brandstore": 299000}', 299000, true),
('PRD-AC-009', 'Dust Collection Bag',     'Accessory', 'Accessory', '{}', 0,      true),
('PRD-AC-010', 'Replacement Battery',     'Accessory', 'Accessory', '{}', 0,      true),
('PRD-AC-011', 'Accessories Kit Premium', 'Accessory', 'Accessory', '{"brandstore": 1490000}', 1490000, true),
('PRD-AC-012', 'Gift Bag Large',          'Accessory', 'Accessory', '{}', 0,      true),
('PRD-AC-013', 'Gift Bag Small',          'Accessory', 'Accessory', '{}', 0,      true)

ON CONFLICT (sku) DO UPDATE SET
  name            = EXCLUDED.name,
  category        = EXCLUDED.category,
  sub_category    = EXCLUDED.sub_category,
  channel_pricing = EXCLUDED.channel_pricing,
  price_retail    = EXCLUDED.price_retail,
  updated_at      = NOW();
