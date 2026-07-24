import { useState } from 'react'

function formatDateTime(date) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Row({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
      <span style={{ color: '#555', flexShrink: 0, paddingRight: 8 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 400, textAlign: 'right', flex: 1 }}>{value}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ borderTop: '1px dashed #bbb', margin: '10px 0' }} />
}

// Ticket de caisse — affiché à l'écran et utilisé comme source pour la capture image
function ReceiptVisual({ order, shopName }) {
  const orderId = order?.id?.slice(0, 8).toUpperCase() || '--------'
  const createdAt = order?.created_at ? formatDateTime(order.created_at) : formatDateTime(new Date())
  const items = order?.items || []
  const total = order?.total_price || 0

  return (
    <div
      id={`receipt-printable-${order?.id || 'preview'}`}
      style={{
        fontFamily: "'Space Mono', 'Courier New', Courier, monospace",
        fontSize: 13,
        background: '#fff',
        color: '#0a0a0a',
        width: 320,
        maxWidth: '100%',
        margin: '0 auto',
        padding: '28px 24px',
        lineHeight: 1.55,
        letterSpacing: 0,
        border: '1px solid #e2e0d9',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>{(shopName || 'BOUCHERIE').toUpperCase()}</div>
        <div style={{ fontSize: 11, marginTop: 4, color: '#444' }}>TICKET DE COMMANDE</div>
      </div>

      <Divider />

      <Row label="Commande" value={`#${orderId}`} />
      <Row label="Date" value={createdAt} />

      <Divider />

      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>ARTICLES</div>
      {items.map((i, idx) => (
        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
            {i.name} x{i.qty}
          </span>
          <span style={{ flexShrink: 0, fontWeight: 600 }}>{(i.price * i.qty).toFixed(2)} €</span>
        </div>
      ))}

      <Divider />

      <Row label="TOTAL" value={`${total.toFixed(2)} €`} bold />

      <Divider />

      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>CLIENT</div>
      <Row label="Nom" value={order?.customer_name} />
      <Row label="Tél." value={order?.phone} />
      {order?.address && <Row label="Adresse" value={order.address} />}

      <Divider />

      <div style={{ textAlign: 'center', fontSize: 11, color: '#555', marginTop: 4, lineHeight: 1.6 }}>
        Conservez ce ticket.<br />
        Il est votre preuve de commande.
      </div>
    </div>
  )
}

// Composant exporté : ticket affiché + bouton de téléchargement en image PNG
export default function Receipt({ order, shopName }) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  async function handleDownload() {
    setDownloading(true)
    setDownloadError('')
    try {
      const html2canvas = (await import('html2canvas')).default
      const node = document.getElementById(`receipt-printable-${order.id}`)
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      link.download = `ticket-commande-${order.id.slice(0, 8).toUpperCase()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Erreur génération ticket :', err)
      setDownloadError("Impossible de générer l'image. Vous pouvez faire une capture d'écran à la place.")
    } finally {
      setDownloading(false)
    }
  }

  if (!order) return null

  return (
    <div className="receipt-block">
      <ReceiptVisual order={order} shopName={shopName} />
      {downloadError && <p className="error-msg" style={{ marginTop: 10 }}>{downloadError}</p>}
      <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={handleDownload} disabled={downloading}>
        {downloading ? 'Génération…' : 'Télécharger le ticket'}
      </button>

      <style>{`
        .receipt-block { display: flex; flex-direction: column; align-items: stretch; }
      `}</style>
    </div>
  )
}
