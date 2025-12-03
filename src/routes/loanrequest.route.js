import  { Router } from 'express';
import { 
  createLoanRequest,
  getAllLoanRequests,
  getLoanRequestById,
  // updateLoanRequest,
 } from '../controllers/loanrequest.controller.js';

 const router = Router();

 router.route('/').post(createLoanRequest).get(getAllLoanRequests);
 router.route('/:id').get(getLoanRequestById).put(updateLoanRequest);


 export default router;