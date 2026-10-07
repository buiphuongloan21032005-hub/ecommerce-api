const prisma = require('../config/prisma');

exports.createShipment = async (req, res) => {
  const { oid } = req.body || {};

  if (!Number.isInteger(oid) || oid <= 0 || oid > 2147483647) {
    return res.status(400).json({
      message: 'oid must be a positive integer',
    });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { oid },
    });

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    const existingShipment = await prisma.shipment.findFirst({
      where: { oid },
    });

    if (existingShipment) {
      return res.status(409).json({
        message: 'Shipment already exists for this order',
        shipment: existingShipment,
      });
    }

    const shipment = await prisma.shipment.create({
      data: {
        oid,
        status: 'PENDING',
      },
    });

    return res.status(201).json({
      message: 'Shipment created successfully',
      shipment,
    });
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    console.error('Create shipment error:', error);

    return res.status(500).json({
      message: 'Cannot create shipment',
    });
  }
};
exports.updateShipmentStatus = async (req, res) => {
  const rawShipid = req.params.shipid;
  const shipid = Number(rawShipid);
  const { status } = req.body || {};

  if (
    !/^[1-9]\d*$/.test(rawShipid) ||
    !Number.isInteger(shipid) ||
    shipid > 2147483647
  ) {
    return res.status(400).json({
      message: 'Invalid shipment ID',
    });
  }

  const validStatuses = ['PENDING', 'SHIPPING', 'DELIVERED'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: 'Status must be PENDING, SHIPPING or DELIVERED',
    });
  }

  try {
    const shipment = await prisma.shipment.findUnique({
      where: { shipid },
    });

    if (!shipment) {
      return res.status(404).json({
        message: 'Shipment not found',
      });
    }

    // Gửi lại trạng thái hiện tại vẫn được xem là thành công.
    if (shipment.status === status) {
      return res.status(200).json({
        message: 'Shipment already has this status',
        shipment,
      });
    }

    const nextStatus = {
      PENDING: 'SHIPPING',
      SHIPPING: 'DELIVERED',
    };

    if (nextStatus[shipment.status] !== status) {
      return res.status(409).json({
        message: `Cannot change status from ${shipment.status} to ${status}`,
      });
    }

    // Chỉ cập nhật nếu trạng thái chưa bị request khác thay đổi.
    const result = await prisma.shipment.updateMany({
      where: {
        shipid,
        status: shipment.status,
      },
      data: { status },
    });

    if (result.count === 0) {
      return res.status(409).json({
        message: 'Shipment changed. Please reload and try again',
      });
    }

    return res.status(200).json({
      message: 'Shipment status updated successfully',
      shipment: {
        ...shipment,
        status,
      },
    });
  } catch (error) {
    console.error('Update shipment status error:', error);

    return res.status(500).json({
      message: 'Cannot update shipment status',
    });
  }
};