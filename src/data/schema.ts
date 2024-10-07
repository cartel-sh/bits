const SakuraSchema = {
  version: 1,
  tables: {
    users: {
      primaryKey: 'id',
      columns: {
        id: {
          type: 'integer',
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: 'string',
          notNull: true,
        },
        email: {
          type: 'string',
          notNull: true,
        },
        password: {
          type: 'string',
          notNull: true,
        },
      },
    },
  }
}

export default SakuraSchema

export type SakuraSchema = {
  [key: string]: {
    primaryKey: string,
    columns: {
      [key: string]: {
        type: string,
        primaryKey?: boolean,
        notNull?: boolean,
        autoIncrement?: boolean,
      }
    }
  }
}