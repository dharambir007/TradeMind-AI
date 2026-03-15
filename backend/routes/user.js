const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getMe, updateMe, deleteMe } = require('../controllers/userController');

const router = express.Router();

router.get('/me', authMiddleware, getMe);

router.put('/update', authMiddleware, updateMe);

router.delete('/delete', authMiddleware, deleteMe);

module.exports = router;
