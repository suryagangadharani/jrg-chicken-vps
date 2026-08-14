CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  contact_email text;
  final_email text;
begin
  contact_email := nullif(new.raw_user_meta_data->>'contact_email', '');
  -- Prefer explicit contact email; else use auth email unless it's the internal phone placeholder domain
  if contact_email is not null then
    final_email := contact_email;
  elsif new.email is not null and new.email not like '%@phone.jrgchicken.app' then
    final_email := new.email;
  else
    final_email := null;
  end if;

  insert into public.profiles(id, email, full_name, phone)
  values (
    new.id,
    final_email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone);

  insert into public.user_roles(user_id, role) values (new.id, 'customer')
  on conflict do nothing;

  if coalesce(contact_email, new.email) = 'suryagangadharani4@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;

  return new;
end $function$;