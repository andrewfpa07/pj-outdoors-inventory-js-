const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DATABASE_URL || 'inventory.db';

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize Database
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    initDB();
  }
});

function initDB() {
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      container INTEGER NOT NULL,
      side TEXT NOT NULL,
      shelf INTEGER NOT NULL,
      quantity INTEGER DEFAULT 0
    )
  `, (err) => {
    if (err) console.error('Table creation error:', err);
  });
}

// Constants
const CONTAINERS = [1, 2, 3, 4, 5, 6, 7, 8];
const SIDES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

// Routes

// HOME - Dashboard
app.get('/', (req, res) => {
  db.all('SELECT container, COUNT(*) AS count FROM products GROUP BY container ORDER BY container', [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }

    const containers = {};
    CONTAINERS.forEach(c => containers[c] = 0);
    rows.forEach(row => containers[row.container] = row.count);

    db.get('SELECT COUNT(*) AS total FROM products', [], (err, totalRow) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }

      db.get('SELECT COUNT(*) AS low FROM products WHERE quantity <= 2', [], (err, lowRow) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Database error');
        }

        const total_products = totalRow.total;
        const low_stock = lowRow.low;
        const containers_used = Object.values(containers).filter(c => c > 0).length;

        res.render('home', {
          containers,
          total_products,
          low_stock,
          containers_used
        });
      });
    });
  });
});

// INDEX - All Products
app.get('/index', (req, res) => {
  db.all('SELECT * FROM products ORDER BY container, shelf', [], (err, products) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    res.render('index', { products });
  });
});

// LOW STOCK Page
app.get('/low-stock', (req, res) => {
  db.all('SELECT * FROM products WHERE quantity <= 2 ORDER BY container, shelf', [], (err, products) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    res.render('low_stock', { products });
  });
});

// ADD Product - GET
app.get('/add', (req, res) => {
  res.render('add_product', { containers: CONTAINERS, sides: SIDES });
});

// ADD Product - POST
app.post('/add', (req, res) => {
  const { name, container, side, shelf, quantity } = req.body;
  const qty = parseInt(quantity) || 0;

  db.run(
    'INSERT INTO products (name, container, side, shelf, quantity) VALUES (?, ?, ?, ?, ?)',
    [name, parseInt(container), side.toUpperCase(), parseInt(shelf), qty],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.redirect('/add');
    }
  );
});

// UPDATE Product - GET
app.get('/update/:id', (req, res) => {
  const productId = req.params.id;

  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (!product) {
      return res.status(404).send('Product not found');
    }
    res.render('update_product', {
      product,
      product_id: productId,
      containers: CONTAINERS,
      sides: SIDES
    });
  });
});

// UPDATE Product - POST
app.post('/update/:id', (req, res) => {
  const productId = req.params.id;
  const { name, container, side, shelf, quantity } = req.body;
  const qty = parseInt(quantity) || 0;

  db.run(
    'UPDATE products SET name=?, container=?, side=?, shelf=?, quantity=? WHERE id=?',
    [name, parseInt(container), side.toUpperCase(), parseInt(shelf), qty, productId],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.redirect('/index');
    }
  );
});

// DELETE Product
app.post('/delete/:id', (req, res) => {
  const productId = req.params.id;

  db.run('DELETE FROM products WHERE id = ?', [productId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    res.redirect('/index');
  });
});

// SEARCH - GET
app.get('/search', (req, res) => {
  res.render('search_product', { results: null });
});

// SEARCH - POST
app.post('/search', (req, res) => {
  const searchName = req.body.name;

  db.all('SELECT * FROM products WHERE name LIKE ?', [`%${searchName}%`], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    res.render('search_product', { results });
  });
});

// CONTAINER View - with default redirect
app.get('/container', (req, res) => {
  // Redirect to container 1 by default
  res.redirect('/container/1');
});

app.get('/container/:id', (req, res) => {
  const containerId = parseInt(req.params.id);

  db.all('SELECT * FROM products WHERE container = ? ORDER BY shelf', [containerId], (err, products) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    res.render('container', { container_id: containerId, products });
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ PJ Outdoors Inventory System running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
});
