import PDFDocument from 'pdfkit';

/**
 * Generate Invoice PDF
 * @param {Object} data - Invoice data { invoiceNumber, date, student, packageBy, amount, orderId }
 * @returns {Promise<Buffer>} - PDF Buffer
 */
export const generateInvoicePDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            let buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            doc.on('error', (err) => {
                reject(err);
            });

            // Header
            doc
                .fontSize(20)
                .text('INVOICE', { align: 'center' })
                .moveDown();

            // Company Details
            doc
                .fontSize(12)
                .text('CMA Test Series Platform', { align: 'right' })
                .text('support@cmatestseries.com', { align: 'right' })
                .moveDown();

            // Invoice Details
            doc
                .fontSize(10)
                .text(`Invoice Number: ${data.invoiceNumber}`, { align: 'left' })
                .text(`Date: ${new Date(data.date).toDateString()}`, { align: 'left' })
                .text(`Order ID: ${data.orderId}`, { align: 'left' })
                .moveDown();

            // Student Details
            doc
                .text(`Billed To:`, { underline: true })
                .text(`Name: ${data.student.name}`)
                .text(`Email: ${data.student.email}`)
                .moveDown();

            // Table Header
            const tableTop = 250;
            doc
                .fontSize(10)
                .text('Item', 50, tableTop, { bold: true })
                .text('Amount (INR)', 400, tableTop, { bold: true, align: 'right' });

            doc
                .moveTo(50, tableTop + 15)
                .lineTo(550, tableTop + 15)
                .stroke();

            // Table Item
            const itemTop = tableTop + 30;
            doc
                .text(data.package.name, 50, itemTop)
                .text(data.amount.toFixed(2), 400, itemTop, { align: 'right' });

            // Total
            const totalTop = itemTop + 30;
            doc
                .moveTo(50, totalTop)
                .lineTo(550, totalTop)
                .stroke();

            doc
                .fontSize(12)
                .text('Total:', 300, totalTop + 15, { bold: true })
                .text(data.amount.toFixed(2), 400, totalTop + 15, { bold: true, align: 'right' });

            // Footer
            doc
                .fontSize(10)
                .text(
                    'This is a computer-generated invoice and does not require a signature.',
                    50,
                    700,
                    { align: 'center', width: 500 }
                );

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};
