import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Bitec Hydrogel Hub"
const LOGO_URL = "https://bitec.cl/wp-content/uploads/2024/10/logo-bitec.svg"

interface StockBajoProps {
  branchName?: string
  fixno?: string
  remainingCuts?: number
  estimatedDays?: number
}

const StockBajoEmail = ({ branchName, fixno, remainingCuts, estimatedDays }: StockBajoProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>⚠️ Stock bajo en {branchName || 'un equipo'} — quedan {remainingCuts ?? '?'} cortes</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img src={LOGO_URL} alt="Bitec" width="120" height="40" style={logo} />
        </Section>

        <Heading style={h1}>⚠️ Alerta de Stock Bajo</Heading>
        <Text style={text}>
          El equipo <strong>{branchName || fixno || 'Sin nombre'}</strong>
          {fixno && branchName ? ` (${fixno})` : ''} tiene un nivel de stock bajo.
        </Text>

        <Section style={alertBox}>
          <Text style={alertText}>
            Cortes restantes: <strong>{remainingCuts ?? 'N/D'}</strong>
          </Text>
          {estimatedDays != null && (
            <Text style={alertText}>
              Autonomía estimada: <strong>{estimatedDays} {estimatedDays === 1 ? 'día' : 'días'}</strong>
            </Text>
          )}
        </Section>

        <Text style={text}>
          Recomendamos reponer insumos a la brevedad para evitar interrupciones en el servicio.
        </Text>

        <Section style={{ textAlign: 'center' as const, margin: '30px 0' }}>
          <Button style={button} href="https://bitec.cl/tienda/">
            Comprar insumos en bitec.cl
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Este es un mensaje automático de {SITE_NAME}. Si tiene consultas, contacte a su ejecutivo comercial.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StockBajoEmail,
  subject: (data: Record<string, any>) =>
    `⚠️ Stock bajo: ${data.branchName || data.fixno || 'equipo'} — ${data.remainingCuts ?? '?'} cortes restantes`,
  displayName: 'Alerta de stock bajo',
  previewData: { branchName: 'Sucursal Centro', fixno: 'FX-1234', remainingCuts: 8, estimatedDays: 3 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '28px', paddingBottom: '20px', borderBottom: '2px solid #e5e7eb' }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3a3a4a', lineHeight: '1.6', margin: '0 0 16px' }
const alertBox = {
  backgroundColor: '#fef3c7',
  borderLeft: '4px solid #f59e0b',
  borderRadius: '6px',
  padding: '16px 20px',
  margin: '20px 0',
}
const alertText = { fontSize: '15px', color: '#92400e', margin: '4px 0', lineHeight: '1.5' }
const button = {
  backgroundColor: '#0ea5e9',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const hr = { borderColor: '#e5e7eb', margin: '30px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '0', lineHeight: '1.5' }
