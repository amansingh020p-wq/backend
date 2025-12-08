import Upi from "../models/upi.model.js";

// Fetch all UPI IDs (admin use)
const getAllUpi = async (req, res) => {
  try {
    const upiList = await Upi.find();
    res.status(200).json({
      success: true,
      data: upiList,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// Add a new UPI entry. If marked active, deactivate the rest.
const addUpi = async (req, res) => {
  try {
    const { id, name, isActive = false, bankName, accountNumber, ifscCode, accountName } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        message: "upi id and business name are required",
      });
    }

    if (isActive) {
      await Upi.updateMany({}, { isActive: false });
    }

    const newUpi = new Upi({
      upiId: id,
      bussinessname: name,
      bankName: bankName || "",
      accountNumber: accountNumber || "",
      ifscCode: ifscCode || "",
      accountName: accountName || "",
      isActive,
    });

    await newUpi.save();
    res.status(201).json({
      success: true,
      data: newUpi,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// Set a specific UPI as active (admin use)
const setActiveUpi = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "UPI id is required",
      });
    }

    const upi = await Upi.findById(id);
    if (!upi) {
      return res.status(404).json({
        success: false,
        message: "UPI not found",
      });
    }

    await Upi.updateMany({}, { isActive: false });
    upi.isActive = true;
    await upi.save();

    res.status(200).json({
      success: true,
      data: upi,
      message: "Active UPI updated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// Get the active UPI for user deposits; fallback to the most recent one
const getActiveUpi = async (_req, res) => {
  try {
    let activeUpi = await Upi.findOne({ isActive: true });
    if (!activeUpi) {
      activeUpi = await Upi.findOne().sort({ updatedAt: -1 });
    }

    if (!activeUpi) {
      return res.status(404).json({
        success: false,
        message: "No UPI details configured",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        upiId: activeUpi.upiId,
        businessName: activeUpi.bussinessname,
        bankName: activeUpi.bankName || "",
        accountNumber: activeUpi.accountNumber || "",
        ifscCode: activeUpi.ifscCode || "",
        accountName: activeUpi.accountName || "",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const updateUpiById = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: upiId, name, bankName, accountNumber, ifscCode, accountName, isActive } = req.body;

    const upi = await Upi.findById(id);
    if (!upi) {
      return res.status(404).json({
        success: false,
        message: "UPI not found",
      });
    }

    // Update fields if provided
    if (upiId) upi.upiId = upiId;
    if (name) upi.bussinessname = name;
    if (bankName !== undefined) upi.bankName = bankName;
    if (accountNumber !== undefined) upi.accountNumber = accountNumber;
    if (ifscCode !== undefined) upi.ifscCode = ifscCode;
    if (accountName !== undefined) upi.accountName = accountName;
    if (isActive !== undefined) {
      if (isActive) {
        await Upi.updateMany({}, { isActive: false });
      }
      upi.isActive = isActive;
    }

    await upi.save();
    res.status(200).json({
      success: true,
      data: upi,
      message: "UPI updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const deleteUpiById = async (req, res) => {
  try {
    const { id } = req.params;
    await Upi.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "UPI deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export { getAllUpi, addUpi, deleteUpiById, setActiveUpi, getActiveUpi, updateUpiById };