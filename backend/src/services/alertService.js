


const logger = require('../utils/logger');
const alertsRepository = require('../db/repositories/alertsRepository');

async function checkAndSendAlerts(product, { price, stock }) {
  const alerts = detectAlerts(product, { price, stock });

  for (const alert of alerts) {
    await alertsRepository.recordAlert(product.id, alert);
    logger.info(`Alert: ${alert.alertType} for "${product.name}"`, alert);

    if (process.env.SENDGRID_API_KEY) {
      await sendEmailAlert(product, alert).catch((err) =>
        logger.error('SendGrid email failed', { error: err.message })
      );
    }
  }
}


function detectAlerts(product, { price, stock }) {
  const alerts = [];

  if (product.last_price != null && price < Number(product.last_price)) {
    alerts.push({ alertType: 'price_drop', oldValue: String(product.last_price), newValue: String(price) });
  }
  if (product.last_stock === 'out_of_stock' && stock === 'in_stock') {
    alerts.push({ alertType: 'back_in_stock', oldValue: product.last_stock, newValue: stock });
  }

  return alerts;
}

async function sendEmailAlert(product, alert) {
  const sgMail = require('@sendgrid/mail'); 
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const subject =
    alert.alertType === 'price_drop'
      ? `Price drop: ${product.name} is now ${alert.newValue}`
      : `Back in stock: ${product.name}`;

  await sgMail.send({
    to: process.env.ALERT_RECIPIENT_EMAIL || process.env.ALERTS_FROM_EMAIL,
    from: process.env.ALERTS_FROM_EMAIL,
    subject,
    text: `${product.name}\n${alert.alertType}: ${alert.oldValue} -> ${alert.newValue}\n${product.product_url}`,
  });
}

module.exports = { checkAndSendAlerts, detectAlerts };
