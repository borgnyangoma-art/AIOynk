import { randomUUID } from 'crypto'

import { newDb, DataType } from 'pg-mem'

const pg = newDb({ autoCreateForeignKeyIndices: true })
pg.public.registerFunction({
  name: 'gen_random_uuid',
  returns: DataType.uuid,
  implementation: () => randomUUID(),
})
const testDb = pg.adapters.createKnex()

export const generateId = () => randomUUID()

export { pg, testDb }
