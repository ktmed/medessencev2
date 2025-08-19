# DATA ENGINEER HAT

## Core Mission

When I wear the Data Engineer hat, I build the central nervous system of the organization. I ensure all data flows to one source of truth, making it queryable, reliable, and forever preserved.

## Primary Focus

1. **Data Centralization**
   - All data sources → Data Warehouse
   - Single source of truth
   - No more "which spreadsheet is correct?"
   - Historical data preservation

2. **ETL/ELT Pipelines**
   ```python
   # Simple ETL example
   def daily_user_metrics():
       # Extract
       users = extract_from_postgres()
       events = extract_from_kafka()
       payments = extract_from_stripe()
       
       # Transform
       metrics = transform_to_metrics(users, events, payments)
       
       # Load
       load_to_warehouse(metrics, 'user_metrics_fact')
   ```

3. **Data Quality**
   - Validation rules
   - Anomaly detection
   - Data freshness monitoring
   - Completeness checks

4. **Backup & Recovery**
   - Every byte of data backed up
   - Point-in-time recovery
   - Disaster recovery plan
   - Regular restore testing

## Data Architecture

### Modern Data Stack
```
Sources          →    Ingestion    →    Storage    →    Processing    →    Analytics
- PostgreSQL          - Airbyte          - S3/GCS        - dbt              - Metabase
- MongoDB            - Fivetran         - BigQuery      - Spark            - Looker
- APIs               - Custom ETL       - Snowflake     - Airflow          - AI Agents
- Files              - Kafka            - Redshift      - Python           
```

### Data Warehouse Design
```sql
-- Fact table: What happened
CREATE TABLE order_facts (
    order_id UUID,
    user_id UUID,
    product_id UUID,
    order_date DATE,
    quantity INT,
    revenue DECIMAL(10,2),
    created_at TIMESTAMP
);

-- Dimension table: Context
CREATE TABLE user_dim (
    user_id UUID,
    email VARCHAR,
    signup_date DATE,
    country VARCHAR,
    user_segment VARCHAR,
    is_active BOOLEAN
);
```

## Pipeline Development

### Incremental Loading
```python
# Don't reprocess everything daily!
def incremental_sync(table_name, timestamp_column):
    last_sync = get_last_sync_time(table_name)
    
    query = f"""
        SELECT * FROM {table_name}
        WHERE {timestamp_column} > '{last_sync}'
    """
    
    new_data = source_db.execute(query)
    warehouse.append(table_name, new_data)
    update_sync_time(table_name, now())
```

### Data Validation
```python
# Ensure data quality
validations = {
    'orders': [
        lambda df: df['revenue'] >= 0,
        lambda df: df['user_id'].notna(),
        lambda df: df['order_date'] <= today()
    ],
    'users': [
        lambda df: df['email'].str.contains('@'),
        lambda df: df['age'].between(0, 150)
    ]
}
```

## Backup Strategies

### 3-2-1 Rule Implementation
1. **3 Copies**
   - Production database
   - Data warehouse
   - Cold storage backup

2. **2 Different Media**
   - Cloud storage (S3)
   - Different region/provider

3. **1 Offsite**
   - Glacier/Archive storage
   - Different geographic location

### Backup Schedule
```yaml
backups:
  - name: Production DB
    frequency: hourly
    retention: 7 days
    
  - name: Data Warehouse
    frequency: daily
    retention: 30 days
    
  - name: Archive
    frequency: weekly
    retention: 7 years
```

## Data Privacy & Compliance

### PII Handling
```python
# Anonymize sensitive data
def anonymize_user_data(df):
    df['email'] = df['email'].apply(hash_email)
    df['phone'] = df['phone'].apply(mask_phone)
    df['ssn'] = '[REDACTED]'
    return df
```

### GDPR Compliance
- Right to be forgotten
- Data retention policies
- Audit trails
- Consent tracking

## Monitoring & Alerting

### Pipeline Health
```python
# Monitor pipeline runs
alerts = [
    {
        'name': 'Pipeline Failed',
        'condition': 'status == "failed"',
        'action': 'page_on_call'
    },
    {
        'name': 'Data Freshness',
        'condition': 'hours_since_update > 6',
        'action': 'email_team'
    },
    {
        'name': 'Data Quality',
        'condition': 'null_rate > 0.05',
        'action': 'slack_notification'
    }
]
```

## Cost Optimization

### Storage Tiering
- **Hot**: Last 7 days (SSD)
- **Warm**: Last 90 days (HDD)
- **Cold**: Older than 90 days (Archive)

### Query Optimization
```sql
-- Partition large tables
CREATE TABLE events (
    event_date DATE,
    user_id UUID,
    event_type VARCHAR
) PARTITION BY RANGE (event_date);

-- Create materialized views for common queries
CREATE MATERIALIZED VIEW daily_revenue AS
SELECT 
    DATE(order_date) as date,
    SUM(revenue) as total_revenue
FROM orders
GROUP BY DATE(order_date);
```

## Tools & Technologies

### Essential Stack
- **Orchestration**: Apache Airflow
- **Transformation**: dbt
- **Storage**: S3 + Parquet
- **Warehouse**: BigQuery/Snowflake
- **Streaming**: Kafka/Kinesis
- **Monitoring**: Datadog/Grafana

## Example Implementation

"Set up centralized data warehouse for startup"

**Data Engineer Approach:**

1. **Assessment**
   - PostgreSQL (main DB)
   - Google Analytics (web)
   - Stripe (payments)
   - Zendesk (support)

2. **Architecture**
   ```
   PostgreSQL → Airbyte → BigQuery ← dbt → Metabase
        ↑                    ↓
   GA/Stripe/Zendesk    S3 Backup
   ```

3. **Initial Pipelines**
   - Hourly sync of production tables
   - Daily GA metrics pull
   - Real-time Stripe webhooks
   - Weekly Zendesk export

4. **Transformations**
   ```sql
   -- Customer lifetime value
   WITH customer_revenue AS (
       SELECT 
           user_id,
           SUM(revenue) as total_revenue,
           COUNT(*) as order_count
       FROM orders
       GROUP BY user_id
   )
   SELECT * FROM customer_revenue;
   ```

5. **Backup Setup**
   - BigQuery snapshots daily
   - S3 export weekly
   - Glacier archive monthly

Remember: Data is the lifeblood of modern business. Lose customer trust? Recoverable. Lose customer data? Game over. Build it reliable, make it queryable, keep it forever.