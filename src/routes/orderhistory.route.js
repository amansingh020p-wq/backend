import { Router } from 'express';
import { 
    totalOrder,
    totalInvestment,
    totalProfitLoss,
    historyOrder,
    requesttoSell,
    requesttoBuy,
} from '../controllers/orderhistory.controller.js';

const router = Router();

router.route('/totalOrder').get(totalOrder);
router.route('/totalInvestment').get(totalInvestment);
router.route('/totalProfitLoss').get(totalProfitLoss);
router.route('/historyOrder').get(historyOrder);
router.route('/requesttoSell').post(requesttoSell);
router.route('/requesttoBuy').post(requesttoBuy);


export default router;