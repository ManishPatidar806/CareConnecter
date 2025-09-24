import mongoose from "mongoose";
import { DB_NAME } from "../constraints.js";
import ApiError from "../utils/ApiError.js";

const dbconnection = async () => {
  try {
    const mongooseInstance = await mongoose.connect(
      `${process.env.MONGOOSE_DATABASE_URL}/${DB_NAME}`
    );
    console.log(`Mongoose is Running At ${mongooseInstance.connection.host}`);
  } catch (error) {
    console.log(`MongooseConnection is Failed ${error}`);
     process.exit(1);
  }
};

export default dbconnection;
