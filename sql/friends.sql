CREATE OR REPLACE FUNCTION public.accept_friend_request(
  p_request_id UUID,
  p_receiver_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_sender_id UUID;
BEGIN
  SELECT sender_id
  INTO v_sender_id
  FROM public.friend_requests
  WHERE id = p_request_id
    AND receiver_id = p_receiver_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or not pending'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.friend_requests
  SET status = 'accepted'
  WHERE id = p_request_id;

  INSERT INTO public.friends (user_id, friend_id)
  VALUES
    (v_sender_id, p_receiver_id),
    (p_receiver_id, v_sender_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$;