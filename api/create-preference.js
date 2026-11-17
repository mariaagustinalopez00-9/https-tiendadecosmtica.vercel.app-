import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    // 1. Configuramos el cliente con tu Token oculto en Vercel
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    try {
        // 2. Recibimos los datos del carrito desde tu frontend
        const { items, payer, shipping_cost } = req.body;

        // 3. Armamos la preferencia (el ticket de cobro)
        const body = {
            items: items, // Los productos
            shipments: {
                cost: shipping_cost,
                mode: "not_specified" // Porque vos ya calculaste el envío
            },
            payer: payer,
            back_urls: {
                success: "https://https-tiendadecosmeticavercelapp.vercel.app/Pagado",
                failure: "https://https-tiendadecosmeticavercelapp.vercel.app/Error",
                pending: "https://https-tiendadecosmeticavercelapp.vercel.app/Pendiente"
            },
            auto_return: "approved"
        };

        // 4. Creamos el link de pago y se lo devolvemos a tu página
        const response = await preference.create({ body });
        res.status(200).json({ id: response.id });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear la preferencia' });
    }
}
