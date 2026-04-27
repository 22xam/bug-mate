import { ClientsService } from './clients.service';

describe('ClientsService CSV import helpers', () => {
  const repository = {
    normalizePhone: (phone: string) => phone.replace(/\D/g, ''),
    count: jest.fn().mockReturnValue(1),
    findAll: jest.fn().mockReturnValue([{ phone: '5491111111111', name: 'Ana' }]),
    findByPhone: jest.fn(),
    upsert: jest.fn((client) => client),
    delete: jest.fn(),
    seed: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const service = new ClientsService(repository as any, { clients: [] } as any, audit as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses CSV clients with systems and tags', () => {
    const clients = service.parseCsv(
      'phone,name,company,systems,tags,notes\n' +
        '5491111111111,Ana,ACME,"crm; facturacion","cliente-activo; vip","nota"',
    );

    expect(clients).toEqual([
      {
        phone: '5491111111111',
        name: 'Ana',
        company: 'ACME',
        systems: ['crm', 'facturacion'],
        tags: ['cliente-activo', 'vip'],
        notes: 'nota',
        knowledgeDocs: [],
        trelloLists: {},
      },
    ]);
  });

  it('previews create/update/invalid rows', () => {
    const preview = service.importPreview([
      {
        phone: '5491111111111',
        name: 'Ana',
        company: 'ACME',
        systems: [],
        tags: ['cliente-activo'],
      },
      {
        phone: '',
        name: '',
        company: '',
        systems: [],
      },
    ]);

    expect(preview[0]).toMatchObject({ action: 'update', valid: true, tags: ['cliente-activo'] });
    expect(preview[1]).toMatchObject({ action: 'create', valid: false, errors: ['phone', 'name'] });
  });
});
