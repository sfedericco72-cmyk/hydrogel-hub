import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Bitec Hydrogel Hub"
const LOGO_URL = "https://bitec.cl/wp-content/uploads/2025/01/logo-bitec-hd.png"

interface DesconectadoProps {
  branchName?: string
  fixno?: string
  daysSinceOnline?: number
}

const DesconectadoEmail = ({ branchName, fixno, daysSinceOnline }: DesconectadoProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>🔌 Equipo desconectado: {branchName || fixno || 'un equipo'} sin conexión hace {daysSinceOnline ?? '?'} días</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img src={LOGO_URL} alt="Bitec" width="120" height="40" style={logo} />
        </Section>

        <Heading style={h1}>🔌 Equipo Desconectado</Heading>
        <Text style={text}>
          El equipo <strong>{branchName || fixno || 'Sin nombre'}</strong>
          {fixno && branchName ? ` (${fixno})` : ''} no se ha conectado en los últimos{' '}
          <strong>{daysSinceOnline ?? '?'} días</strong>.
        </Text>

        <Section style={alertBox}>
          <Text style={alertTitle}>¿Por qué es importante conectar el equipo?</Text>
          <Text style={alertText}>
            Recomendamos conectar el equipo a Internet al menos <strong>una vez por semana</strong> y
            realizar la actualización de datos ingresando al menú <strong>Configuración → Actualización de Datos</strong>.
          </Text>
          <Text style={alertText}>
            De esta manera, la base de datos del equipo se mantiene sincronizada con todos los
            modelos disponibles y se asegura su correcto funcionamiento.
          </Text>
        </Section>

        <Text style={text}>
          Si el equipo no puede conectarse, le sugerimos verificar la conexión a Internet o
          contactar a su ejecutivo comercial para recibir asistencia.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Este es un mensaje automático de {SITE_NAME}. Si tiene consultas, contacte a su ejecutivo comercial.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DesconectadoEmail,
  subject: (data: Record<string, any>) =>
    `🔌 Equipo desconectado: ${data.branchName || data.fixno || 'equipo'} sin conexión hace ${data.daysSinceOnline ?? '?'} días`,
  displayName: 'Equipo desconectado',
  previewData: { branchName: 'Sucursal Centro', fixno: 'FX-1234', daysSinceOnline: 6 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '28px', paddingBottom: '20px', borderBottom: '2px solid #e5e7eb' }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3a3a4a', lineHeight: '1.6', margin: '0 0 16px' }
const alertBox = {
  backgroundColor: '#fef2f2',
  borderLeft: '4px solid #ef4444',
  borderRadius: '6px',
  padding: '16px 20px',
  margin: '20px 0',
}
const alertTitle = { fontSize: '15px', fontWeight: 'bold' as const, color: '#991b1b', margin: '0 0 8px' }
const alertText = { fontSize: '14px', color: '#7f1d1d', margin: '0 0 8px', lineHeight: '1.5' }
const hr = { borderColor: '#e5e7eb', margin: '30px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '0', lineHeight: '1.5' }
