// The Hono app, mounted at /api/* by routes/api/$.ts (which strips the
// prefix before calling .fetch()).
import { Hono } from 'hono'
import { errorHandler } from './lib/errors'
import { authRoute } from './modules/auth'
import { auditRoute, usersRoute } from './modules/users'
import { claimsRoute } from './modules/claims'
import { dashboardRoute } from './modules/dashboard'
import { filesRoute } from './modules/files'
import { fundersRoute } from './modules/funders'
import { investigatorsRoute } from './modules/investigators'
import { lookupsRoute } from './modules/lookups'
import { paymentsRoute, retirementsRoute } from './modules/payments'
import { personnelRoute } from './modules/personnel'
import { activitiesRoute, phasesRoute, projectsRoute } from './modules/projects'
import { remittancesRoute } from './modules/remittances'
import { publicRoute, requestsRoute } from './modules/requests'
import { ratesRoute } from './modules/rates'

const app = new Hono()

app.onError(errorHandler)
app.get('/health', (c) => c.json({ ok: true }))

app.route('/auth', authRoute)
app.route('/public', publicRoute)
app.route('/files', filesRoute)
app.route('/lookups', lookupsRoute)
app.route('/dashboard', dashboardRoute)
app.route('/funders', fundersRoute)
app.route('/investigators', investigatorsRoute)
app.route('/personnel', personnelRoute)
app.route('/projects', projectsRoute)
app.route('/phases', phasesRoute)
app.route('/activities', activitiesRoute)
app.route('/claims', claimsRoute)
app.route('/payments', paymentsRoute)
app.route('/retirements', retirementsRoute)
app.route('/remittances', remittancesRoute)
app.route('/rates', ratesRoute)
app.route('/requests', requestsRoute)
app.route('/users', usersRoute)
app.route('/audit', auditRoute)

app.notFound((c) => c.json({ error: 'Not found' }, 404))

export { app as apiApp }
