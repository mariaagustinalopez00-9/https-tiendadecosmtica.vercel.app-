export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'Falta MP_ACCESS_TOKEN en Vercel' });
  }

  try {
    const { items = [], payer = {}, shipping_cost = 0 } = req.body || {};

    const mpItems = items.map(item => ({
      title: String(item.title || 'Producto PRONTA'),
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      currency_id: 'ARS'
    }));

    if (Number(shipping_cost) > 0) {
      mpItems.push({
        title: 'Envío PRONTA',
        quantity: 1,
        unit_price: Number(shipping_cost),
        currency_id: 'ARS'
      });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: mpItems,
        payer: {
          name: payer.name || '',
          email: payer.email || ''
        },
        back_urls: {
          success: origin,
          failure: origin,
          pending: origin
        },
        auto_return: 'approved'
      })
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      return res.status(mpRes.status).json({ error: data.message || 'Error de Mercado Pago', details: data });
    }

    return res.status(200).json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error interno al crear preferencia' });
  }
}
