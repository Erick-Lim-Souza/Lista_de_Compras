/**
 * js/export.js
 * ─────────────────────────────────────────────────────────────
 * All file-generation and download operations.
 * Depends on: Calculator (loaded before this file in HTML)
 * Depends on: jsPDF (CDN script tag)
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const Exporter = (() => {

  // ── Generic download ───────────────────────────────────────────
  function _download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ── Group items by category ────────────────────────────────────
  function _byCategory(items) {
    return items.reduce((acc, item) => {
      (acc[item.category] = acc[item.category] || []).push(item);
      return acc;
    }, {});
  }

  // ── TXT ────────────────────────────────────────────────────────
  function toTxt(items, listName, listType, listTypeEmoji, getCatEmoji) {
    let text = `📝 ${listName} (${listTypeEmoji} ${listType})\n`;
    text    += `Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;

    Object.entries(_byCategory(items)).forEach(([cat, catItems]) => {
      text += `${getCatEmoji(cat)} ${cat}:\n`;
      catItems.forEach(item => {
        const status = item.completed ? '✅' : '⬜';
        const u      = Calculator.calculateUnitPrice(item);
        let   pStr   = '';
        if (u.wholesale > 0 || u.retail > 0) {
          pStr = ` — ATK: R$${Calculator.formatPrice(u.wholesale)} | VRJ: R$${Calculator.formatPrice(u.retail)}`;
        }
        text += `  ${status} ${item.quantity} ${item.unit} de ${item.name}${pStr}\n`;
      });
      text += '\n';
    });

    const t = Calculator.calculateTotals(items);
    if (t.general > 0) {
      text += `💰 Total Atacado : R$${Calculator.formatPrice(t.wholesale)}\n`;
      text += `💰 Total Varejo  : R$${Calculator.formatPrice(t.retail)}\n`;
      text += `💚 Economia      : R$${Calculator.formatPrice(t.economy)}\n`;
    }

    _download(`${listName}.txt`, text, 'text/plain;charset=utf-8');
  }

  // ── PDF ────────────────────────────────────────────────────────
  function toPdf(items, listName, listType, getCatEmoji) {
    if (!items.length)       return false;
    if (!window.jspdf)       return false;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica');

    // Title
    doc.setFontSize(16); doc.setTextColor(0, 196, 140);
    doc.text(listName, 20, 24);

    // Meta
    doc.setFontSize(9); doc.setTextColor(130, 130, 130);
    doc.text(`Tipo: ${listType}   |   Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, 32);

    doc.setDrawColor(220, 220, 220); doc.line(20, 36, 190, 36);
    let y = 46;

    Object.entries(_byCategory(items)).forEach(([cat, catItems]) => {
      if (y > 250) { doc.addPage(); y = 20; }

      doc.setFontSize(11); doc.setTextColor(0, 196, 140);
      doc.text(`${getCatEmoji(cat)} ${cat}`, 20, y); y += 5;
      doc.setDrawColor(0, 196, 140); doc.line(20, y, 80, y); y += 7;

      doc.setFontSize(9); doc.setTextColor(30, 30, 30);
      catItems.forEach(item => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${item.completed ? '[✓]' : '[ ]'} ${item.quantity} ${item.unit} de ${item.name}`, 25, y); y += 5;

        const u = Calculator.calculateUnitPrice(item);
        if (u.wholesale > 0 || u.retail > 0) {
          doc.setFontSize(8); doc.setTextColor(100, 100, 100);
          if (u.wholesale > 0) { doc.text(`   Atacado: R$${Calculator.formatPrice(u.wholesale)}`, 30, y); y += 4; }
          if (u.retail    > 0) { doc.text(`   Varejo:  R$${Calculator.formatPrice(u.retail)}`,    30, y); y += 4; }
          doc.setFontSize(9); doc.setTextColor(30, 30, 30);
        }
        y += 1;
      });
      y += 5;
    });

    // Totals
    const t = Calculator.calculateTotals(items);
    if (t.general > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setDrawColor(220, 220, 220); doc.line(20, y, 190, y); y += 8;
      doc.setFontSize(10); doc.setTextColor(0, 196, 140); doc.text('TOTAIS', 20, y); y += 7;
      doc.setFontSize(9); doc.setTextColor(30, 30, 30);
      if (t.wholesale > 0) { doc.text(`Atacado : R$${Calculator.formatPrice(t.wholesale)}`, 25, y); y += 5; }
      if (t.retail    > 0) { doc.text(`Varejo  : R$${Calculator.formatPrice(t.retail)}`,    25, y); y += 5; }
      if (t.economy   > 0) { doc.setTextColor(0, 196, 140); doc.text(`Economia: R$${Calculator.formatPrice(t.economy)}`, 25, y); }
    }

    // Page numbers
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(7); doc.setTextColor(180, 180, 180);
      doc.text(`Página ${i}/${pages}`, 172, 286);
      doc.text('Lista de Compras — Green Monster Project', 20, 286);
    }

    doc.save(`${listName}.pdf`);
    return true;
  }

  // ── CSV ────────────────────────────────────────────────────────
  function toCsv(items, listName) {
    const BOM  = '\uFEFF';   // UTF-8 BOM so Excel opens correctly
    const rows = [['Item','Categoria','Qtd','Unidade','Preço ATK','Preço VRJ','Total ATK','Total VRJ','Status']];

    items.forEach(item => {
      const u   = Calculator.calculateUnitPrice(item);
      const fmt = v => v.toFixed(2).replace('.', ',');
      rows.push([
        item.name, item.category, String(item.quantity), item.unit,
        fmt(item.priceWholesale || 0), fmt(item.priceRetail || 0),
        fmt(u.wholesale), fmt(u.retail),
        item.completed ? 'Comprado' : 'Pendente',
      ]);
    });

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    _download(`${listName}.csv`, BOM + csv, 'text/csv;charset=utf-8');
  }

  return { toTxt, toPdf, toCsv };
})();
