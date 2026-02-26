const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan');
const loginController = require('./controller/loginController.js');
const podcastEntryController = require('./controller/podcastEntryController.js');
const userController = require('./controller/usersController.js');
const adminController = require('./controller/adminController.js');
const authController = require('./controller/authController.js');
const userDashboard = require('./controller/userDashboardController.js');
const { AuthenticateToken } = require('./validations/UserTokenAuth.js');
const { apiLimiter } = require('./validations/rateLimiter.js');
const { errorHandler } = require('./middleware/errorHandler.js');

app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(morgan('dev'));
app.use(apiLimiter);

app.get('/', (req, res) => {
    res.send('Hello Gemini!');
});
app.use('/login', loginController);
app.use('/auth', authController);
app.use('/admin', adminController);
app.use('/users/:user_id/podcastentries', AuthenticateToken, podcastEntryController);
app.use('/users', userController);
app.use('/users/:id/dashboard', AuthenticateToken, userDashboard);

app.get("*", (req, res) => {
    res.status(404).json({ error: 'Path not Found' });
});

// Global error handler — must be after all routes
app.use(errorHandler);

module.exports = app;