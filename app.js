const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan');
const loginController = require('./controller/loginController.js');
const podcastEntryController = require('./controller/podcastEntryController.js');
const userController = require('./controller/usersController.js');
const adminController = require('./controller/adminController.js');
const { AuthenticateToken } = require('./validations/UserTokenAuth.js');

app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

app.get('/', (req, res) => {
    res.send('Hello Gemini!');
});
app.use('/login', loginController);
app.use('/admin', adminController);
app.use('/users/:user_id/podcastentries', AuthenticateToken, podcastEntryController);
app.use('/users', userController);
// app.use('/users/:id/dashboard',AuthenticateToken, userDashBoard);

app.get("*", (req, res) => {
    res.status(404).json({ error: 'Path not Found' });
});

module.exports = app;