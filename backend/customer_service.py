"""
Customer Master service. CRUD for customers in portal Postgres.
Sage 50 customer data is READ-ONLY enrichment — never written to Sage.
"""
import db_service
import audit_service


def create_customer(data, created_by="portal"):
    row = db_service.insert_returning(
        """INSERT INTO core.customers
           (name, contact, address, city, province, postal_code, country,
            phone, email, website, payment_terms, credit_limit, currency_code,
            notes, sage_id)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
           RETURNING *""",
        (data.get("name"), data.get("contact"), data.get("address"),
         data.get("city"), data.get("province"), data.get("postal_code"),
         data.get("country", "Canada"), data.get("phone"), data.get("email"),
         data.get("website"), data.get("payment_terms"),
         data.get("credit_limit"), data.get("currency_code", "CAD"),
         data.get("notes"), data.get("sage_id"))
    )
    audit_service.log_from_request("CREATE", "CUSTOMER", row["id"], after=data)
    return row


def update_customer(customer_id, data):
    before = get_customer(customer_id)
    if not before:
        return None

    db_service.execute(
        """UPDATE core.customers SET
           name = COALESCE(%s, name),
           contact = COALESCE(%s, contact),
           address = COALESCE(%s, address),
           city = COALESCE(%s, city),
           province = COALESCE(%s, province),
           postal_code = COALESCE(%s, postal_code),
           phone = COALESCE(%s, phone),
           email = COALESCE(%s, email),
           website = COALESCE(%s, website),
           payment_terms = COALESCE(%s, payment_terms),
           credit_limit = COALESCE(%s, credit_limit),
           notes = COALESCE(%s, notes),
           updated_at = NOW()
           WHERE id = %s""",
        (data.get("name"), data.get("contact"), data.get("address"),
         data.get("city"), data.get("province"), data.get("postal_code"),
         data.get("phone"), data.get("email"), data.get("website"),
         data.get("payment_terms"), data.get("credit_limit"),
         data.get("notes"), customer_id)
    )
    audit_service.log_from_request("UPDATE", "CUSTOMER", customer_id, before=before, after=data)
    return get_customer(customer_id)


def get_customer(customer_id):
    cust = db_service.fetch_one(
        "SELECT * FROM core.customers WHERE id = %s", (customer_id,)
    )
    if cust:
        cust["contacts"] = db_service.fetch_all(
            "SELECT * FROM core.customer_contacts WHERE customer_id = %s ORDER BY is_primary DESC, id",
            (customer_id,)
        )
    return cust


def list_customers(search=None, limit=100, offset=0):
    if search:
        return db_service.fetch_all(
            """SELECT * FROM core.customers
               WHERE name ILIKE %s OR email ILIKE %s
               ORDER BY name LIMIT %s OFFSET %s""",
            (f"%{search}%", f"%{search}%", limit, offset)
        )
    return db_service.fetch_all(
        "SELECT * FROM core.customers ORDER BY name LIMIT %s OFFSET %s",
        (limit, offset)
    )


def add_contact(customer_id, data):
    return db_service.insert_returning(
        """INSERT INTO core.customer_contacts
           (customer_id, name, role, phone, email, is_primary)
           VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
        (customer_id, data.get("name"), data.get("role"),
         data.get("phone"), data.get("email"),
         data.get("is_primary", False))
    )


def set_customer_pricing(customer_id, item_no, price, effective_date=None):
    return db_service.insert_returning(
        """INSERT INTO core.customer_pricing
           (customer_id, item_no, price, effective_date)
           VALUES (%s,%s,%s,COALESCE(%s, CURRENT_DATE))
           RETURNING *""",
        (customer_id, item_no, price, effective_date)
    )
