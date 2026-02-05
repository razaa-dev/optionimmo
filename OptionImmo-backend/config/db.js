import mysql from 'mysql2/promise';

let pool;

const connectDB = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test the connection
    const connection = await pool.getConnection();
    console.log(`MySQL Connected: ${process.env.DB_HOST}`);
    connection.release();

    // Create table if not exists
    await createContactsTable();

    return pool;
  } catch (error) {
    console.error(`MySQL Connection Error: ${error.message}`);
    process.exit(1);
  }
};

const createContactsTable = async () => {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      asset_type VARCHAR(50) NOT NULL,
      asset_location TEXT NOT NULL,
      asset_value VARCHAR(100) NOT NULL,
      deadline VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      photos JSON,
      email_sent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  try {
    await pool.execute(createTableSQL);
    console.log('Contacts table ready');
  } catch (error) {
    console.error('Error creating contacts table:', error.message);
  }
};

export const getPool = () => pool;

export default connectDB;
