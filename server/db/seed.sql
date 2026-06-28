-- Seed data: ~15 realistic expenses across various categories
-- Mix of MYR and IDR entries, spanning June 2026 and a few from May 2026
-- Exchange rate used: 1 MYR ≈ 3,600 IDR

INSERT INTO expenses (name, category, price_myr, price_idr, original_currency, exchange_rate_used, timestamp) VALUES
-- May 2026 entries
('Weekly groceries',           'Grocery',              85.50,   307800.00, 'MYR', 3600.00, '2026-05-18T10:30:00+08:00'),
('Grab ride to office',        'Transport',            12.00,    43200.00, 'MYR', 3600.00, '2026-05-22T08:15:00+08:00'),
('Netflix subscription',       'Subscription',         45.90,   165240.00, 'MYR', 3600.00, '2026-05-01T00:00:00+08:00'),

-- June 2026 entries
('Nasi Lemak breakfast',       'Food',                  8.50,    30600.00, 'MYR', 3600.00, '2026-06-02T07:45:00+08:00'),
('Monthly rent',               'Rent',               1200.00,  4320000.00, 'MYR', 3600.00, '2026-06-01T09:00:00+08:00'),
('Electricity bill',           'Utilities',            78.00,   280800.00, 'MYR', 3600.00, '2026-06-05T14:00:00+08:00'),
('Indomie bulk pack',          'Grocery',              NULL,    45000.00,  'IDR', 3600.00, '2026-06-07T11:20:00+08:00'),
('Gojek ride Jakarta',         'Transport',            NULL,    25000.00,  'IDR', 3600.00, '2026-06-08T17:30:00+08:00'),
('Online Python course',       'Education',           149.00,   536400.00, 'MYR', 3600.00, '2026-06-10T20:00:00+08:00'),
('Movie tickets x2',          'Entertainment',         36.00,   129600.00, 'MYR', 3600.00, '2026-06-12T19:00:00+08:00'),
('Clinic visit & medicine',   'Health/Medical',        65.00,   234000.00, 'MYR', 3600.00, '2026-06-14T10:00:00+08:00'),
('Bakso street food',          'Food',                  NULL,    15000.00,  'IDR', 3600.00, '2026-06-15T12:30:00+08:00'),
('ASB monthly deposit',       'Savings/Investment',   500.00,  1800000.00, 'MYR', 3600.00, '2026-06-15T08:00:00+08:00'),
('New headphones',            'Non-Primary Expenses',  199.00,   716400.00, 'MYR', 3600.00, '2026-06-18T16:45:00+08:00'),
('Birthday gift for friend',  'Other Expenses',        75.00,   270000.00, 'MYR', 3600.00, '2026-06-20T13:00:00+08:00'),
('Weekly groceries',           'Grocery',              92.30,   332280.00, 'MYR', 3600.00, '2026-06-22T10:00:00+08:00'),
('Spotify subscription',      'Subscription',          15.90,    57240.00, 'MYR', 3600.00, '2026-06-01T00:00:00+08:00');
