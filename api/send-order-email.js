export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta RESEND_API_KEY en Vercel' });
  }

  try {
    const { order, toEmail, adminCopyEmail } = req.body || {};
    if (!order || !toEmail) {
      return res.status(400).json({ error: 'Faltan datos del pedido o correo destino' });
    }

    const fromAddress = process.env.RESEND_FROM_EMAIL || 'PRONTA <onboarding@resend.dev>';
    const orderIdShort = String(order.id || '').slice(0, 8) || 'ORDEN';

    const itemsRows = Array.isArray(order.items)
      ? order.items.map(i => `
          <tr>
            <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(i.name || 'Producto')}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${Number(i.qty || 1)}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">$${Number(i.price || 0).toLocaleString('es-AR')}</td>
          </tr>
        `).join('')
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
        <h2 style="margin: 0 0 6px; letter-spacing: 2px;">PRONTA</h2>
        <p style="margin: 0 0 18px; color: #666; font-size: 14px;">Detalle de tu orden #${escapeHtml(orderIdShort)}</p>

        <div style="background: #FAF8F6; padding: 14px; border-radius: 8px; font-size: 14px; margin-bottom: 18px;">
          <strong>Cliente:</strong> ${escapeHtml(order.customer_name || '-')}<br>
          <strong>Teléfono:</strong> ${escapeHtml(order.customer_phone || '-')}<br>
          <strong>Envío:</strong> ${escapeHtml(order.shipping_method || '-')} ($${Number(order.shipping_cost || 0).toLocaleString('es-AR')})<br>
          <strong>Dirección / Nota:</strong> ${escapeHtml(order.shipping_address || '-')}<br>
          <strong>Medio de pago:</strong> ${escapeHtml(order.payment_method || '-')}<br>
          <strong>Estado:</strong> ${escapeHtml(order.status || 'Pendiente')}
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 8px; border-bottom: 2px solid #D4A3A3;">Producto</th>
              <th style="text-align: center; padding: 8px; border-bottom: 2px solid #D4A3A3;">Cant.</th>
              <th style="text-align: right; padding: 8px; border-bottom: 2px solid #D4A3A3;">Precio u.</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>

        <p style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 18px;">
          Total: $${Number(order.total || 0).toLocaleString('es-AR')}
        </p>
      </div>
    `;

    const recipients = [toEmail];
    if (adminCopyEmail && adminCopyEmail !== toEmail) {
      recipients.push(adminCopyEmail);
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: recipients,
        subject: `Tu orden #${orderIdShort} en PRONTA`,
        html
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data.message || 'Error enviando correo con Resend', details: data });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error interno al enviar email' });
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
