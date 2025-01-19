import mongoose from "mongoose";


const mongoConnector = async () => {
    try {
        // Ensure that MONGO_URI is present in the environment variables
        if (!process.env.MONGO_URI) {
            console.error("MONGO_URI is not defined in the .env file");
            process.exit(1);
        }
    // Connect to MongoDB using Mongoose
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        })
        console.log("Database connection established");
    } catch (err) {
        console.log("Error connecting to Mongo", err);
        process.exit(1)
    }
}

export default mongoConnector