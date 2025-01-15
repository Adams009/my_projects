import mongoose from "mongoose";


const mongoConnector = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("Database connection established");
    } catch (err) {
        console.log("Error connecting to Mongo", err);
        process.exit(1)
    }
}

export default mongoConnector