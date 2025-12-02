/**
 * PDF Generation Module
 * Visual Style: "TecSie" Exact Replica (Grid Body + Clean Footer)
 */
export default class PdfGenerator {
    static generate(docData) {
        const { jsPDF } = window.jspdf;
        
        const format = docData.pageSize || 'a4';
        const doc = new jsPDF({ format: format, unit: 'mm' });

        // --- Config ---
        const hexToRgb = (hex) => {
            if(!hex) return [0,0,0];
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return [r, g, b];
        };

        const themeColor = hexToRgb(docData.business.themeColor || '#2563eb');
        const colorText = [0, 0, 0]; 
        const currency = docData.business.currency || 'LKR';

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        
        const docType = docData.type.toUpperCase(); 
        const balanceLabel = (docData.type === 'quotation' || docData.type === 'estimate') ? 'Estimated Total' : 'Balance Due';

        // --- Header Function ---
        const drawHeader = () => {
            let leftY = 15;
            
            // 1. LEFT SIDE: LOGO & ADDRESS
            if (docData.business.logoUrl) {
                try {
                    // Calculate logo dimensions to maintain aspect ratio
                    const img = new Image();
                    img.src = docData.business.logoUrl;
                    
                    const maxWidth = 50;
                    const maxHeight = 20;
                    let logoWidth = maxWidth;
                    let logoHeight = maxHeight;
                    
                    // Maintain aspect ratio
                    if (img.width && img.height) {
                        const aspectRatio = img.width / img.height;
                        if (aspectRatio > maxWidth / maxHeight) {
                            logoHeight = maxWidth / aspectRatio;
                        } else {
                            logoWidth = maxHeight * aspectRatio;
                        }
                    }
                    
                    doc.addImage(docData.business.logoUrl, 'PNG', margin, leftY, logoWidth, logoHeight);
                    leftY += logoHeight + 5;
                } catch(e) { 
                    doc.setFontSize(20);
                    doc.setTextColor(...themeColor);
                    doc.setFont("times", "bold");
                    doc.text(docData.business.name || "", margin, leftY + 10);
                    leftY += 15;
                }
            } else {
                doc.setFontSize(20);
                doc.setTextColor(...themeColor);
                doc.setFont("times", "bold");
                doc.text(docData.business.name || "", margin, leftY + 10);
                leftY += 15;
            }

            // Biz Name (Text below logo) - Skip if logo is shown
            if (!docData.business.logoUrl) {
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);
                doc.setFont("times", "bold");
                doc.text(docData.business.name || "", margin, leftY);
                leftY += 5;
            }
            
            // Address
            doc.setFont("times", "normal");
            doc.setFontSize(9);
            const addressLines = doc.splitTextToSize(docData.business.address || '', 80).filter(line => line.trim() !== '');
            const addressStartY = leftY + 5;
            doc.text(addressLines, margin, addressStartY);
            
            // Contact - calculate exact position based on rendered address height
            const contactInfo = [docData.business.email, docData.business.phone].filter(Boolean).join(' | ');
            if (contactInfo) {
                const addressHeight = doc.getTextDimensions(addressLines).h;
                doc.text(contactInfo, margin, addressStartY + addressHeight + 1);
            }

            // 2. RIGHT SIDE: TITLE & BALANCE
            const rightX = pageWidth - margin;
            let rightY = 20;

            // "INVOICE" (Sleek)
            doc.setFontSize(28);
            doc.setFont("times", "normal"); 
            doc.text(docType, rightX, rightY, { align: 'right' });

            // "Invoice# ..."
            rightY += 7;
            doc.setFontSize(8);
            doc.setFont("times", "bold");
            doc.text(`${docData.type.charAt(0).toUpperCase() + docData.type.slice(1)}# ${docData.number}`, rightX, rightY, { align: 'right' });

            // Balance Due Section (Clean Text, No Box)
            rightY += 10;
            doc.setFontSize(9);
            doc.setTextColor(50, 50, 50);
            doc.text(balanceLabel, rightX, rightY, { align: 'right' });
            
            rightY += 6;
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.setFont("times", "bold");
            doc.text(`${currency} ${docData.totals.grandTotal.toFixed(2)}`, rightX, rightY, { align: 'right' });
        };

        // --- Info Row: Bill To & Dates ---
        const drawInfoRow = (startY) => {
            // Bill To
            doc.setFontSize(10);
            doc.setFont("times", "normal");
            doc.setTextColor(0, 0, 0);
            doc.text("Bill To", margin, startY);
            
            doc.setFont("times", "bold");
            doc.setFontSize(11);
            doc.text(docData.customer.name || "Client Name", margin, startY + 6);
            
            doc.setFont("times", "normal");
            doc.setFontSize(10);
            const address = doc.splitTextToSize(docData.customer.address || "", 80);
            doc.text(address, margin, startY + 11);
            
            // Reduce gap between address block and contact line (phone/email)
            let contactY = startY + 11 + (address.length * 5) + 1;
            const contactInfo = [];
            if(docData.customer.phone) contactInfo.push(docData.customer.phone);
            if(docData.customer.email) contactInfo.push(docData.customer.email);
            if(contactInfo.length > 0) {
                doc.text(contactInfo.join(' | '), margin, contactY);
            }

            // Dates (Right aligned on same line as Bill To)
            const rightX = pageWidth - margin;
            doc.setFontSize(10);
            doc.setFont("times", "normal");
            doc.text("Invoice Date :", rightX, startY, { align: 'right' });
            doc.text(docData.date, rightX, startY + 5, { align: 'right' });
            
            if(docData.dueDate) {
                doc.text("Due Date :", rightX, startY + 11, { align: 'right' });
                doc.text(docData.dueDate, rightX, startY + 16, { align: 'right' });
            }
        };

        // Draw Top Sections
        drawHeader();
        drawInfoRow(85); 

        // --- Table Data Preparation ---
        const tableBody = docData.items.map((item, i) => [
            String(i + 1),                                  // Column 0: Index
            String(item.name || '') +                       // Column 1: Item name
                (item.description ? `\n${item.description}` : ''),
            Number(item.qty || 0),                          // Column 2: Qty
            Number(item.price || 0).toFixed(2),             // Column 3: Rate
            Number(item.total || (item.qty * item.price || 0)).toFixed(2) // Column 4: Amount
        ]);

        // --- Footer Rows Construction ---
        const footerRows = [];
        
        // Sub Total (Clean, No Borders) - removed spacer row for tighter layout
        footerRows.push([
            { content: 'Sub Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'normal', lineWidth: 0 } }, 
            { content: docData.totals.subtotal.toFixed(2), styles: { halign: 'right', fontStyle: 'normal', lineWidth: 0 } }
        ]);

        // 3. Tax (if applicable)
        if(docData.totals.tax > 0) {
            footerRows.push([
                { content: 'Tax', colSpan: 4, styles: { halign: 'right', fontStyle: 'normal', lineWidth: 0 } }, 
                { content: docData.totals.tax.toFixed(2), styles: { halign: 'right', fontStyle: 'normal', lineWidth: 0 } }
            ]);
        }

        // Discount (if applicable)
        if(docData.totals.discount > 0) {
            footerRows.push([
                { content: 'Discount', colSpan: 4, styles: { halign: 'right', fontStyle: 'normal', lineWidth: 0, textColor: [0, 0, 0] } }, 
                { content: `-${docData.totals.discount.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'normal', lineWidth: 0, textColor: [0, 0, 0] } }
            ]);
        }

        // Shipping (if applicable)
        if(docData.totals.shipping > 0) {
            footerRows.push([
                { content: 'Shipping', colSpan: 4, styles: { halign: 'right', fontStyle: 'normal', lineWidth: 0, textColor: [0, 0, 0] } }, 
                { content: docData.totals.shipping.toFixed(2), styles: { halign: 'right', fontStyle: 'normal', lineWidth: 0, textColor: [0, 0, 0] } }
            ]);
        }

        // 5. Total (Top Border Only)
        footerRows.push([
            { content: 'Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', lineWidth: { top: 0.3, bottom: 0, left: 0, right: 0 }, lineColor: [220, 220, 220] } }, 
            { content: `${currency}${docData.totals.grandTotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', lineWidth: { top: 0.3, bottom: 0, left: 0, right: 0 }, lineColor: [220, 220, 220] } }
        ]);

        // 6. Balance Due (Gray Background)
        footerRows.push([
            { content: 'Balance Due', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [235, 235, 235], lineWidth: 0, textColor: [0, 0, 0], cellPadding: 6 } }, 
            { content: `${currency}${docData.totals.grandTotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [235, 235, 235], lineWidth: 0, textColor: [0, 0, 0], cellPadding: 6 } }
        ]);

        const bottomMarginReserved = 60; 

        // --- AutoTable Generation ---
        doc.autoTable({
            startY: 110, 
            head: [['#', 'Item & Description', 'Qty', 'Rate', 'Amount']], // Ensure explicit 5 columns
            body: tableBody,
            foot: footerRows, // Attach the footer rows here
            theme: 'grid',    // CHANGE: Use 'grid' to ensure vertical lines appear in the body
            styles: {
                fontSize: 9,
                cellPadding: 4,
                textColor: colorText,
                lineColor: [230, 230, 230], // Light gray grid lines
                lineWidth: 0.1,            // Thin lines
                valign: 'middle'
            },
            headStyles: {
                fillColor: [50, 50, 50],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'left',
                lineWidth: 0.1,
                lineColor: [50, 50, 50] // Match fill color to hide borders if desired, or lighter for separation
            },
            bodyStyles: {
                // Ensure vertical lines are shown (do not override lineWidth to 0 here)
                lineWidth: 0.1,
                lineColor: [230, 230, 230] 
            },
            alternateRowStyles: {
                fillColor: [255, 255, 255] // Keep plain white or use [250, 250, 250] for zebra
            },
            footStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                lineWidth: 0 // Default footer cells to no border (overridden in footerRows definitions)
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' }, // Narrow '#' column
                1: { cellWidth: 'auto' },
                2: { cellWidth: 20, halign: 'center' }, // Qty Center
                3: { cellWidth: 30, halign: 'right' },
                4: { cellWidth: 35, halign: 'right' }
            },
            showHead: 'firstPage', // Only show header on first page
            showFoot: 'lastPage',  // Only show footer on last page
            margin: { left: margin, right: margin, bottom: bottomMarginReserved }
        });

        // --- Footer Notes & Bank Details ---
        let finalY = doc.lastAutoTable.finalY + 10;
        if (finalY > pageHeight - bottomMarginReserved + 10) {
            doc.addPage();
            finalY = 20;
        }

        // Notes Section
        let notesY = finalY;
        if (docData.notes && docData.notes.trim()) {
            if (notesY > pageHeight - bottomMarginReserved + 10) {
                doc.addPage();
                notesY = 20;
            }
            doc.setFontSize(11);
            doc.setFont("times", "bold");
            doc.text("Notes", margin, notesY);
            
            doc.setFont("times", "normal");
            doc.setFontSize(10);
            const notesLines = doc.splitTextToSize(docData.notes, pageWidth - (margin * 2));
            doc.text(notesLines, margin, notesY + 6);
            notesY += 6 + (notesLines.length * 5) + 10;
        }
        
        // Bank Details Section
        if (docData.business.showBankDetails) {
            let bankY = docData.notes && docData.notes.trim() ? notesY : finalY + 20;
            if (bankY > pageHeight - bottomMarginReserved + 10) {
                doc.addPage();
                bankY = 20;
            }

            doc.setFontSize(11);
            doc.setFont("times", "bold");
            doc.text("Bank details are as follows,", margin, bankY);
            
            doc.setFont("times", "normal");
            doc.setFontSize(10);
            
            const bankInfo = [
                `Bank Name : ${docData.business.bankName || 'Sampath Bank'}`,
                `Branch : ${docData.business.branch || 'Kottawa'}`,
                `Account Name : ${docData.business.name}`,
                `Account Number : ${docData.business.accountNo || '0052 1001 0639'}`
            ];
            
            bankInfo.forEach((line, i) => {
                doc.text(line, margin, bankY + 7 + (i * 6));
            });
        }

        // Global Page Footer
        const pageCount = doc.internal.getNumberOfPages();
        const rightX = pageWidth - margin;
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(200);
            doc.line(margin, pageHeight - 15, rightX, pageHeight - 15);
            
            const contactInfo = [docData.business.email, docData.business.phone].filter(Boolean).join(' | ');
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(contactInfo, margin, pageHeight - 10);
            doc.text(`Page ${i} of ${pageCount}`, rightX, pageHeight - 10, { align: 'right' });
        }

        doc.save(`${docData.type}-${docData.number}.pdf`);
    }
}