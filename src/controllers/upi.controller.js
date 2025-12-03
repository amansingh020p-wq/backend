    import Upi from "../models/upi.model.js";



    const getAllUpi = async (req, res) => {
        try {
            const upiList = await Upi.find();
            res.status(200).json({
                success: true,
                data: upiList
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Server Error"
            });
        }
    };

    const addUpi = async (req, res) => {
        try {
            const { id, name } = req.body;
            const newUpi = new Upi({
                upiId: id,
                bussinessname: name
            });

            await newUpi.save();
            res.status(201).json({
                success: true,
                data: newUpi
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Server Error"
            });
        }
    };

    const deleteUpiById = async (req, res) => {
        try {
            const { id } = req.params;
            await Upi.findByIdAndDelete(id);
            res.status(200).json({
                success: true,
                message: "UPI deleted successfully"
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Server Error"
            });
        }
    };

    export {
        getAllUpi,
        addUpi,
        deleteUpiById,
    }