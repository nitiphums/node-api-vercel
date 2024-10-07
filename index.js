const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.3.1', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const app = express();
const PORT = 3000; // Set the desired port
app.use(express.json());

// API Home route
app.get('/', (req, res) => {
  res.send('This is my API running');
});

// Customer Schema
const customerSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  phone: String,
  rate_discount: { type: Number, default: null },
  wallet: { type: Number, default: 0 },
});

const Customer = mongoose.model('Customer', customerSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  product_name: String,
  product_price: Number,
  purchase_date: { type: Date, default: Date.now },
});

const Order = mongoose.model('Order', orderSchema);

// 1. Create a customer
app.post('/customers', async (req, res) => {
  const { name, email, password, phone } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const customer = new Customer({ name, email, password: hashedPassword, phone });
  await customer.save();
  res.status(201).json(customer);
});

// 2. Read all customers
app.get('/customers', async (req, res) => {
  const customers = await Customer.find();
  res.json(customers);
});

// 3. Read a single customer
app.get('/customers/:id', async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  res.json(customer);
});

// 4. Update a customer
app.put('/customers/:id', async (req, res) => {
  const { name, email, password, phone } = req.body;
  const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;
  const updatedData = { name, email, phone };
  if (hashedPassword) updatedData.password = hashedPassword;
  const customer = await Customer.findByIdAndUpdate(req.params.id, updatedData, { new: true });
  res.json(customer);
});

// 5. Delete a customer
app.delete('/customers/:id', async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

// 1.2 Wallet Top-Up API
app.post('/customers/:id/topup', async (req, res) => {
  const { wallet_topup } = req.body;
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).send('Customer not found');
  customer.wallet += wallet_topup;
  await customer.save();
  res.json(customer);
});

// Add or Update Rate Discount API
app.post('/customers/:id/discount', async (req, res) => {
  const { rate_discount } = req.body;

  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).send('Customer not found');

  if (rate_discount < 0 || rate_discount > 100) {
    return res.status(400).send('Invalid rate_discount value. Must be between 0 and 100');
  }

  customer.rate_discount = rate_discount;
  await customer.save();
  res.json(customer);
});

// 1.3 Purchase API
app.post('/customers/:id/purchase', async (req, res) => {
  const { product_name, product_price } = req.body;
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).send('Customer not found');

  const discount = customer.rate_discount ? (customer.rate_discount / 100) * product_price : 0;
  const final_price = product_price - discount;

  if (customer.wallet < final_price) {
    return res.status(400).send('Insufficient wallet balance');
  }

  customer.wallet -= final_price;
  await customer.save();

  const order = new Order({
    customer_id: customer._id,
    product_name,
    product_price: final_price,
  });

  await order.save();
  res.json(order);
});

// 1.4 API to show all orders
app.get('/orders', async (req, res) => {
  const orders = await Order.find().populate('customer_id', 'name email');
  res.json(orders);
});

// 1.5 API to show orders for a specific customer
app.get('/customers/:id/orders', async (req, res) => {
  const orders = await Order.find({ customer_id: req.params.id });
  res.json(orders);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
