import LoanRequest from '../models/loanrequest.model.js';
import User from '../models/user.model.js';

const createLoanRequest = async (req, res) => {
  try {
    const userId = req.cookies.userId;  //TODO: check if userId is in cookie or header

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, duration } = req.body;
    if (!amount || !duration) {
      return res.status(400).json({ error: 'Amount and duration are required' });
    }
    if (isNaN(amount) || isNaN(duration)) {
      return res.status(400).json({ error: 'Amount and duration must be numbers' });
    }

    if (amount <= 0 || duration <= 0) {
      return res.status(400).json({ error: 'Amount and duration must be positive numbers' });
    }

    

    // Get user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has a pending loan request
    const pendingLoan = await LoanRequest.findOne({
      userId: user._id,
      status: 'PENDING',
    });

    if (pendingLoan) {
      return res.status(400).json({
        error: 'You already have a pending loan request. Please wait for it to be processed before submitting another one.',
      });
    }

    // Create new loan request
    const loanRequest = new LoanRequest({
      userId: user._id,
      amount: parseFloat(amount),
      duration: parseInt(duration),
    });

    await loanRequest.save();

    return res.status(201).json(loanRequest);
  } catch (error) {
    console.error('Loan request error:', error);
    return res.status(500).json({ error: 'Failed to create loan request' });
  }
}

const getAllLoanRequests = async (req, res) => {
  try {
    const userId = req.cookies.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch all loan requests for the user, ordered by creation date
    const loanRequests = await LoanRequest.find({ userId: user._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json(loanRequests);
  } catch (error) {
    console.error('Fetch loan requests error:', error);
    return res.status(500).json({ error: 'Failed to fetch loan requests' });
  }
}

const getLoanStatus = async (req, res) => {
  try {
    const userId = req.cookies.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find approved loan for the user
    const approvedLoan = await LoanRequest.findOne({
      userId: userId,
      status: 'APPROVED',
    }).sort({ updatedAt: -1 });

    return res.status(200).json({
      hasApprovedLoan: !!approvedLoan,
      loanDetails: approvedLoan,
    });
  } catch (error) {
    console.error('Loan status check error:', error);
    return res.status(500).json({ error: 'Failed to check loan status' });
  }
};


const getLoanRequestsById = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({
      status: "fail",
      message: "Please provide loan request ID"
    })
  }
  try {
    const loanRequest = await LoanRequest.findById(id);
    if (!loanRequest) {
      return res.status(404).json({
        status: "fail",
        message: "Loan request not found"
      })
    }
    res.status(200).json({
      status: "success",
      // TODO: add user details aggregation , and also many place ??
      data: loanRequest
    })
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message
    })
  }
} 



export {
  createLoanRequest,
  getAllLoanRequests,
  getLoanRequestsById,
  getLoanStatus,
  // updateLoanRequest
}