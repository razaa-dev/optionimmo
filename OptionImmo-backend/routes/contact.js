import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { getPool } from '../config/db.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG, and JPG files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per file
  }
});

// Configure nodemailer transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Asset type labels for emails
const assetTypeLabels = {
  maison: 'Maison',
  appartement: 'Appartement',
  immeuble: 'Immeuble',
  commerce: 'Commerce',
  terrain: 'Terrain',
  garage: 'Garage'
};

// POST /api/contact - Handle contact form submission
router.post('/', upload.array('photos', 10), async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      asset_type,
      asset_location,
      asset_value,
      deadline,
      message
    } = req.body;

    // Prepare photo data
    const photos = req.files ? req.files.map(file => ({
      filename: file.filename,
      path: file.path,
      originalName: file.originalname
    })) : [];

    // Save to MySQL
    const pool = getPool();
    const insertSQL = `
      INSERT INTO contacts (first_name, last_name, email, phone, asset_type, asset_location, asset_value, deadline, message, photos)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(insertSQL, [
      first_name,
      last_name,
      email,
      phone,
      asset_type,
      asset_location,
      asset_value,
      deadline,
      message,
      JSON.stringify(photos)
    ]);

    const contactId = result.insertId;
    console.log('Contact saved to MySQL, ID:', contactId);

    // Prepare email attachments
    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      path: file.path
    })) : [];

    const transporter = createTransporter();
    const fullName = `${first_name} ${last_name}`;
    const assetTypeLabel = assetTypeLabels[asset_type] || asset_type;

    // Send notification email to admin with form data
    const adminMailOptions = {
      from: `"Option Immo" <${process.env.EMAIL_USER}>`,
      to: 'contact@optionimmo.be',
      subject: `Nouvelle demande - ${fullName} - ${assetTypeLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #1e293b; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #ffffff; margin: 0;">Nouvelle Demande</h1>
          </div>
          <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1e293b;">Informations client</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Nom complet</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${fullName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Email</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: bold; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${email}">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;">Téléphone</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: bold;"><a href="tel:${phone}">${phone}</a></td>
              </tr>
            </table>

            <h2 style="color: #1e293b;">Détails du bien</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Type de bien</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${assetTypeLabel}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Localisation</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${asset_location}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Valeur estimée</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${asset_value}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;">Délai souhaité</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: bold;">${deadline}</td>
              </tr>
            </table>

            <h2 style="color: #1e293b;">Message</h2>
            <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <p style="color: #475569; margin: 0; white-space: pre-wrap;">${message}</p>
            </div>

            <p style="color: #64748b; margin-top: 20px;"><strong>Photos jointes :</strong> ${attachments.length}</p>
            <p style="color: #64748b; font-size: 12px;">ID de la demande : ${contactId}</p>
          </div>
        </div>
      `,
      attachments: attachments
    };

    // Send email to admin
    try {
      await transporter.sendMail(adminMailOptions);

      // Update contact to mark email as sent
      await pool.execute('UPDATE contacts SET email_sent = TRUE WHERE id = ?', [contactId]);

      console.log('Email sent successfully to admin');

      // Send confirmation email to the user
      const userMailOptions = {
        from: `"Option Immo" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Confirmation de votre demande - Option Immo`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1e293b; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0;">Merci, ${first_name} !</h1>
            </div>
            <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="color: #475569;">Nous avons bien reçu votre demande concernant votre <strong>${assetTypeLabel}</strong> à <strong>${asset_location}</strong>.</p>

              <h2 style="color: #1e293b;">Résumé de votre demande</h2>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 10px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Type de bien</td>
                  <td style="padding: 10px 0; color: #1e293b; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${assetTypeLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Localisation</td>
                  <td style="padding: 10px 0; color: #1e293b; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${asset_location}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Valeur estimée</td>
                  <td style="padding: 10px 0; color: #1e293b; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${asset_value}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b;">Délai souhaité</td>
                  <td style="padding: 10px 0; color: #1e293b; font-weight: bold;">${deadline}</td>
                </tr>
              </table>

              <p style="color: #475569;">Notre équipe va reprendre contact avec vous très prochainement.</p>
              <p style="color: #64748b; font-size: 12px;">Référence de votre demande : #${contactId}</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(userMailOptions);
      console.log('Confirmation email sent to user:', email);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the request if email fails - data is already saved
    }

    res.status(200).json({
      success: true,
      message: 'Votre demande a été envoyée avec succès !'
    });

  } catch (error) {
    console.error('Error processing contact form:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement de votre demande'
    });
  }
});

// GET /api/contact - Get all contacts (for admin purposes)
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM contacts ORDER BY created_at DESC');
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
