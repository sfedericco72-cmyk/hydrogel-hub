import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

// Plataforma — siempre fija. El nombre del tenant NO va acá.
const PLATFORM_NAME = "CutMonitor"

interface EmailNoConfiguradoProps {
  branchName?: string
  fixno?: string
  customerName?: string
  alertType?: string
  /** Logo del tenant — aparece en el header */
  logoUrl?: string
  /** Nombre del tenant — usado como alt del logo */
  tenantName?: string
}

const EmailNoConfiguradoEmail = ({
  branchName,
  fixno,
  customerName,
  alertType,
  logoUrl,
  tenantName,
}: EmailNoConfiguradoProps) => {
  return (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>📋 Equipo sin email configurado: {branchName || fixno || 'un equipo'}</Preview>
    <Body style={main}>
      <Container style={container}>
        {logoUrl ? (
        <Section style={headerSection}>
            <Img src={logoUrl} alt={tenantName || ''} width="120" height="40" style={logo} />
        </Section>
        ) : null}

        <Heading style={h1}>📋 Email de alerta no configurado</Heading>
        <Text style={text}>
          Se detectó una alerta de tipo <strong>{alertType || 'desconocido'}</strong> para el equipo{' '}
          <strong>{branchName || fixno || 'Sin nombre'}</strong>
          {fixno && branchName ? ` (${fixno})` : ''}
          {customerName ? ` — Cliente: ${customerName}` : ''}, pero no tiene un email de alerta configurado.
        </Text>

        <Section style={alertBox}>
          <Text style={alertTitle}>Acción requerida</Text>
          <Text style={alertText}>
            Ingresa a la plataforma y configura un email de alerta para este equipo en la sección
            de <strong>Gestión de Emails</strong>, para que las alertas lleguen directamente al cliente.
          </Text>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Este es un mensaje automático de {PLATFORM_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
  )
}

export const template = {
  component: EmailNoConfiguradoEmail,
  subject: (data: Record<string, any>) =>
    `📋 Email no configurado: ${data.branchName || data.fixno || 'equipo'} (alerta ${data.alertType || ''})`,
  displayName: 'Email de alerta no configurado',
  previewData: {
    branchName: 'Sucursal Centro',
    fixno: 'FX-1234',
    customerName: 'Hospital ABC',
    alertType: 'stock bajo',
    tenantName: 'Bitec',
    logoUrl: 'https://bitec.cl/wp-content/uploads/2025/01/logo-bitec-hd.png',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '28px', paddingBottom: '20px', borderBottom: '2px solid #e5e7eb' }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3a3a4a', lineHeight: '1.6', margin: '0 0 16px' }
const alertBox = {
  backgroundColor: '#eff6ff',
  borderLeft: '4px solid #3b82f6',
  borderRadius: '6px',
  padding: '16px 20px',
  margin: '20px 0',
}
const alertTitle = { fontSize: '15px', fontWeight: 'bold' as const, color: '#1e40af', margin: '0 0 8px' }
const alertText = { fontSize: '14px', color: '#1e3a5f', margin: '0 0 8px', lineHeight: '1.5' }
const hr = { borderColor: '#e5e7eb', margin: '30px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '0', lineHeight: '1.5' }
