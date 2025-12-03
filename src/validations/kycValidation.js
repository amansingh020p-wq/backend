import { z } from 'zod';

export const kycRegistrationSchema = z.object({
  // Personal Info
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone number must be 10 digits'),
  email: z.string().email('Invalid email address'),
  
  // KYC Info
  aadharNumber: z.string().regex(/^[0-9]{12}$/, 'Aadhar number must be 12 digits'),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format'),
  
  // Bank Details
  bankName: z.string().min(2, 'Bank name must be at least 2 characters'),
  accountHolderName: z.string().min(2, 'Account holder name must be at least 2 characters'),
  accountNumber: z.string().min(9, 'Account number must be at least 9 digits'),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
  branchName: z.string().min(2, 'Branch name must be at least 2 characters'),
  
  // Terms
  agreedToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and conditions'
  })
});

export const validateKycRegistration = (data) => {
  try {
    return { success: true, data: kycRegistrationSchema.parse(data) };
  } catch (error) {
    return { 
      success: false, 
      errors: error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }))
    };
  }
}; 