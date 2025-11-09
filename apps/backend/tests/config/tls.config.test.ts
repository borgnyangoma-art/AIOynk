import { readFileSync } from 'fs'
import path from 'path'

describe('Nginx TLS configuration', () => {
  const nginxConfig = readFileSync(
    path.resolve(__dirname, '../../../../nginx/nginx.conf'),
    'utf-8',
  )

  it('enforces TLS 1.2 and 1.3 with strong ciphers', () => {
    expect(nginxConfig).toContain('ssl_protocols TLSv1.2 TLSv1.3;')
    expect(nginxConfig).toContain('ssl_ciphers HIGH:!aNULL:!MD5;')
  })

  it('sends strict transport headers required by REQ-044', () => {
    expect(nginxConfig).toContain('Strict-Transport-Security')
    expect(nginxConfig).toContain("add_header Content-Security-Policy")
  })
})
