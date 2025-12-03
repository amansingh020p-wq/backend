import Settings from '../models/settings.model.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Get bank details visibility setting
const getBankDetailsVisibility = asyncHandler(async (req, res) => {
    // Default to true if setting doesn't exist
    const showBankDetails = await Settings.getSetting('showBankDetails', true);
    
    return res.status(200).json(
        new ApiResponse(200, { showBankDetails }, "Bank details visibility setting retrieved successfully")
    );
});

// Update bank details visibility setting (Admin only)
const updateBankDetailsVisibility = asyncHandler(async (req, res) => {
    const { showBankDetails } = req.body;
    
    if (typeof showBankDetails !== 'boolean') {
        throw new ApiError(400, "showBankDetails must be a boolean value");
    }
    
    await Settings.setSetting(
        'showBankDetails',
        showBankDetails,
        'Controls whether bank transfer option is shown to users during deposit'
    );
    
    return res.status(200).json(
        new ApiResponse(200, { showBankDetails }, "Bank details visibility setting updated successfully")
    );
});

export {
    getBankDetailsVisibility,
    updateBankDetailsVisibility
};

