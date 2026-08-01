begin;

select plan(16);

select has_table(
  'public',
  'email_link_recovery_transactions',
  'email-link recovery ledger exists'
);
select has_column(
  'public',
  'email_link_recovery_transactions',
  'state_digest',
  'ledger stores only an opaque state digest key'
);
select hasnt_column(
  'public',
  'email_link_recovery_transactions',
  'email',
  'ledger stores no raw email'
);
select hasnt_column(
  'public',
  'email_link_recovery_transactions',
  'firebase_uid',
  'ledger stores no raw Firebase UID'
);
select ok(
  not has_table_privilege('anon', 'public.email_link_recovery_transactions', 'select'),
  'anonymous callers cannot read recovery transactions'
);
select ok(
  not has_table_privilege('authenticated', 'public.email_link_recovery_transactions', 'select'),
  'authenticated callers cannot read recovery transactions'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.begin_email_link_recovery_transaction(text,timestamptz)',
    'execute'
  ),
  'authenticated callers cannot begin recovery transactions'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_email_link_recovery_transaction(text)',
    'execute'
  ),
  'authenticated callers cannot consume recovery transactions'
);

set local role service_role;

select is(
  public.begin_email_link_recovery_transaction(repeat('a', 43), clock_timestamp() + interval '10 minutes'),
  true,
  'service role begins an opaque short-lived transaction'
);
select is(
  public.inspect_email_link_recovery_transaction(repeat('a', 43)),
  'valid',
  'new transaction is valid'
);
select is(
  public.consume_email_link_recovery_transaction(repeat('a', 43)),
  'consumed',
  'first consume succeeds'
);
select is(
  public.inspect_email_link_recovery_transaction(repeat('a', 43)),
  'replayed',
  'consumed transaction is marked as replayed'
);
select is(
  public.consume_email_link_recovery_transaction(repeat('a', 43)),
  'replayed',
  'second consume fails closed as a replay'
);
select is(
  public.inspect_email_link_recovery_transaction('malformed'),
  'invalid',
  'malformed state digest fails closed'
);
select is(
  public.begin_email_link_recovery_transaction(repeat('b', 43), clock_timestamp() - interval '1 second'),
  false,
  'expired transaction cannot begin'
);
select is(
  public.begin_email_link_recovery_transaction(repeat('c', 43), clock_timestamp() + interval '21 minutes'),
  false,
  'overlong transaction cannot begin'
);

select * from finish();

rollback;
