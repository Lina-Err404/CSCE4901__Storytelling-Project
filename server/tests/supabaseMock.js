function createSupabaseMock(seed = {}) {
  const tables = Object.fromEntries(
    Object.entries(seed).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]),
  );
  let generatedId = 0;
  const primaryKeys = {
    profiles: ['id'],
    classes: ['class_id'],
    class_students: ['class_id', 'student_id'],
    lobbies: ['lobby_id'],
    lobby_participants: ['lobby_id', 'student_id'],
  };

  function createQuery(table) {
    const query = {
      operation: 'select',
      filters: [],
      ordering: [],
      select() {
        return this;
      },
      eq(column, value) {
        this.filters.push((row) => row[column] === value);
        return this;
      },
      neq(column, value) {
        this.filters.push((row) => row[column] !== value);
        return this;
      },
      in(column, values) {
        this.filters.push((row) => values.includes(row[column]));
        return this;
      },
      order(column, { ascending = true } = {}) {
        this.ordering.push({ column, ascending });
        return this;
      },
      limit(count) {
        this.rowLimit = count;
        return this;
      },
      insert(values) {
        this.operation = 'insert';
        this.values = values;
        return this;
      },
      upsert(values, options = {}) {
        this.operation = 'upsert';
        this.values = values;
        this.options = options;
        return this;
      },
      update(values) {
        this.operation = 'update';
        this.values = values;
        return this;
      },
      delete() {
        this.operation = 'delete';
        return this;
      },
      async maybeSingle() {
        const result = await this.execute();
        return { data: result.data?.[0] ?? null, error: result.error };
      },
      async single() {
        const result = await this.execute();
        if (result.error) return result;
        if (result.data?.length !== 1) {
          return { data: null, error: new Error('Expected exactly one row') };
        }
        return { data: result.data[0], error: null };
      },
      then(resolve, reject) {
        return this.execute().then(resolve, reject);
      },
      async execute() {
        const rows = tables[table] || (tables[table] = []);
        const matches = (row) => this.filters.every((filter) => filter(row));

        if (this.operation === 'select') {
          let selected = rows.filter(matches).map((row) => ({ ...row }));
          for (const { column, ascending } of this.ordering) {
            selected.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
          }
          if (Number.isInteger(this.rowLimit)) selected = selected.slice(0, this.rowLimit);
          return { data: selected, error: null };
        }

        if (this.operation === 'insert' || this.operation === 'upsert') {
          const inputRows = Array.isArray(this.values) ? this.values : [this.values];
          const written = [];
          for (const input of inputRows) {
            const keys = this.options?.onConflict?.split(',') || primaryKeys[table] || [];
            const existing = keys.length
              ? rows.find((row) => keys.every((key) => row[key] === input[key]))
              : undefined;
            if (existing) {
              if (this.operation === 'insert') {
                return { data: null, error: Object.assign(new Error('Duplicate key'), { code: '23505' }) };
              }
              if (!this.options?.ignoreDuplicates) Object.assign(existing, input);
              written.push(existing);
              continue;
            }
            const row = { ...input };
            if (table === 'classes' && !row.class_id) {
              generatedId += 1;
              row.class_id = `00000000-0000-4000-8000-${String(generatedId).padStart(12, '0')}`;
            }
            if (table === 'lobbies' && !row.lobby_id) {
              generatedId += 1;
              row.lobby_id = `00000000-0000-4000-8000-${String(generatedId).padStart(12, '0')}`;
            }
            rows.push(row);
            written.push(row);
          }
          return { data: written, error: null };
        }

        const affected = rows.filter(matches);
        if (this.operation === 'update') {
          affected.forEach((row) => Object.assign(row, this.values));
          return { data: null, error: null };
        }
        if (this.operation === 'delete') {
          tables[table] = rows.filter((row) => !matches(row));
          return { data: null, error: null };
        }
        return { data: null, error: new Error('Unsupported mock query') };
      },
    };
    return query;
  }

  return {
    tables,
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: jest.fn((table) => createQuery(table)),
  };
}

module.exports = { createSupabaseMock };
