const express = require('express');

const {
  createShipment,
  updateShipmentStatus,
} = require('../controllers/shipmentController');

const {
  authenticate,
  authorize,
} = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authenticate, authorize('ADMIN'));

router.post('/', createShipment);

router.patch('/:shipid/status', updateShipmentStatus);

module.exports = router;