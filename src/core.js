"use strict";
var Core = (() => {
  const norm = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const doi = value => String(value || "").trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").toLowerCase();
  function validDOI(value) {return /^10\.\d{4,9}\/\S+$/i.test(doi(value));}
  function isbn(value) {
    const s = String(value || "").replace(/[^0-9X]/gi, "").toUpperCase();
    if (s.length === 13) return [...s].reduce((sum, n, i) => sum + Number(n) * (i % 2 ? 3 : 1), 0) % 10 === 0;
    if (s.length === 10 && /^\d{9}[\dX]$/.test(s)) return [...s].reduce((sum, n, i) => sum + (n === "X" ? 10 : Number(n)) * (10 - i), 0) % 11 === 0;
    return false;
  }
  function storedCodes(item) {
    return [...new Set((item.attachments || []).filter(a => !a.deleted && ["imported_file", "imported_url", "embedded_image"].includes(a.linkMode)).map(a => a.key))].sort().join(", ");
  }
  function context(text, index) {return text.slice(Math.max(0, index - 100), Math.min(text.length, index + 220)).replace(/\s+/g, " ").trim();}
  function csv(rows) {
    if (!rows.length) return "";
    const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const escape = value => {
      let s = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
      if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    return "\uFEFF" + [headers, ...rows.map(row => headers.map(key => row[key]))].map(row => row.map(escape).join(";")).join("\r\n");
  }
  function tags(item, prefix) {return (item.tags || []).filter(t => norm(t).startsWith(norm(prefix))).map(t => t.slice(t.indexOf(":") + 1).trim()).filter(Boolean);}
  const issue = (item, severity, field, message) => ({key:item.key, title:item.title, severity, field, message});
    function audit(items) {
    const rows=[];
    for(const item of items) {
      const files=item.attachments||[];
      if(!files.length)rows.push(issue(item,"Alta","attachment","Referência sem anexo. Isso não comprova inexistência do documento."));
      for(const a of files) {
        const target={...item,key:a.key,title:a.title||item.title};
        if(a.linkMode==="linked_url") {rows.push(issue(target,"Revisar","attachment","Somente link externo; texto não está armazenado localmente."));continue;}
        if(!a.exists) {rows.push(issue(target,"Alta","attachment","Arquivo indisponível localmente. Pode precisar de sincronização ou relocalização."));continue;}
        if(a.error) {rows.push(issue(target,"Revisar","text",`Não foi possível ler o texto: ${a.error}`));continue;}
        const text=String(a.text||"");
        if(a.contentType==="application/pdf" && text.replace(/\s/g,"").length<80) rows.push(issue(target,"Revisar","OCR","Pouco texto extraído nas páginas examinadas. Pode precisar de OCR; não é prova de arquivo corrompido."));
        const front=text.slice(0,18000);
        for(const [pattern,label] of [[/\b(?:draft|rascunho|brouillon)\b/i,"Sinal de rascunho"],[/\b(?:overview|executive summary|resumo executivo|note de pr[eé]sentation)\b/i,"Possível resumo ou documento de apoio"]]) {
          const match=pattern.exec(front);
          if(match)rows.push({...issue(target,"Revisar","version",label+". O termo também pode estar em uma citação ou no assunto do documento; conferir página."),evidence:context(front,match.index)});
        }
        if(a.totalPages && a.extractedPages<a.totalPages) rows.push(issue(target,"Informação","pages",`Examinadas ${a.extractedPages} de ${a.totalPages} páginas. A análise não atesta integridade do documento inteiro.`));
      }
    }
    return rows;
  }
  const PluginCore={audit};

  return {norm, doi, validDOI, isbn, storedCodes, csv, tags, ...PluginCore};
})();
if (typeof module !== "undefined") module.exports = Core;
