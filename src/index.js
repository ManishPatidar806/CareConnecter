import { configDotenv } from "dotenv";
configDotenv({
  path: "./.env",
});
import dbconnection from "./db/dbconnection.js";
import app from "./app.js";
const port = process.env.PORT;

await dbconnection()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is Running At Port : ${port}`);
    });
  })
  .catch((error) => {
    console.log(`DataBase Connection Failed ${error}`);
    process.exit(1);
  });
