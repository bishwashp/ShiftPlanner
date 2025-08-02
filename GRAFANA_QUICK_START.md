# 🎯 Grafana Quick Start Guide for ShiftPlanner

## 🚀 Quick Setup

### 1. Deploy the Complete Stack
```bash
# Deploy the entire production stack including Grafana
./deploy-phase6.sh
```

### 2. Access Grafana Dashboard
- **URL**: http://localhost:3001
- **Username**: `admin`
- **Password**: `admin` (or the value of `GRAFANA_PASSWORD` from your `.env` file)

## 📊 Available Dashboards

### ShiftPlanner Overview Dashboard
- **Location**: Automatically loaded on first access
- **Features**:
  - System Health Status
  - Response Time Metrics
  - Request Rate Monitoring
  - Error Rate Tracking
  - Database Connection Pool
  - Redis Memory Usage
  - Cache Hit Rate
  - Active Users Count

## 🔍 Key Metrics to Monitor

### System Performance
- **Response Time**: Target < 200ms for 95% of requests
- **Request Rate**: Monitor requests per second
- **Error Rate**: Should be < 0.1%
- **Cache Hit Rate**: Target > 80%

### Infrastructure Health
- **Database Connections**: Monitor connection pool usage
- **Redis Memory**: Watch for memory pressure
- **System Resources**: CPU and memory usage
- **Uptime**: Target 99.9% availability

### Application Metrics
- **Active Users**: Real-time user count
- **Slow Queries**: Database performance
- **API Endpoints**: Most used endpoints
- **Error Types**: Categorize and track errors

## 🛠️ Customizing Dashboards

### Adding New Panels
1. Click the **+** button in the top right
2. Select **Add new panel**
3. Choose **Prometheus** as data source
4. Write PromQL queries like:
   ```promql
   # Response time 95th percentile
   histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
   
   # Error rate
   rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
   
   # Cache hit rate
   rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
   ```

### Creating Alerts
1. Go to **Alerting** → **Alert rules**
2. Click **New alert rule**
3. Set conditions like:
   - Response time > 500ms
   - Error rate > 1%
   - Cache hit rate < 70%
   - Database connections > 80%

## 📈 Useful PromQL Queries

### Performance Metrics
```promql
# Average response time
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# 95th percentile response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Request rate by method
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

### Cache Metrics
```promql
# Cache hit rate
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))

# Cache hit rate percentage
(rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))) * 100
```

### Database Metrics
```promql
# Database connections
shiftplanner_database_connections

# Slow queries
rate(shiftplanner_slow_queries_total[5m])

# Query duration
rate(shiftplanner_query_duration_seconds_sum[5m]) / rate(shiftplanner_query_duration_seconds_count[5m])
```

### System Metrics
```promql
# Memory usage
shiftplanner_memory_usage_bytes

# CPU usage
shiftplanner_cpu_usage_percent

# Active users
shiftplanner_active_users

# Uptime
shiftplanner_uptime_seconds
```

## 🔧 Troubleshooting

### Grafana Not Loading
1. Check if containers are running:
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

2. Check Grafana logs:
   ```bash
   docker-compose -f docker-compose.prod.yml logs grafana
   ```

3. Verify Prometheus is collecting data:
   - Visit http://localhost:9090
   - Go to **Status** → **Targets**
   - Check if `shiftplanner-backend` target is **UP**

### No Data in Dashboards
1. Verify metrics endpoint is working:
   ```bash
   curl http://localhost:4000/monitoring/prometheus-metrics
   ```

2. Check Prometheus targets:
   - Visit http://localhost:9090/targets
   - Ensure all targets show **UP** status

3. Verify data source connection:
   - In Grafana, go to **Configuration** → **Data sources**
   - Test the Prometheus connection

### Performance Issues
1. Check system resources:
   ```bash
   docker stats
   ```

2. Monitor container logs:
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f backend
   ```

3. Verify database performance:
   - Check slow query logs
   - Monitor connection pool usage

## 🎯 Best Practices

### Dashboard Organization
- Group related metrics together
- Use consistent naming conventions
- Set appropriate refresh intervals (10-30s for real-time)
- Use color coding for status indicators

### Alert Configuration
- Set realistic thresholds
- Use different severity levels
- Include relevant context in alert messages
- Test alert delivery channels

### Performance Monitoring
- Monitor key business metrics
- Track user experience metrics
- Set up automated performance testing
- Regular capacity planning reviews

## 🚀 Next Steps

1. **Custom Dashboards**: Create dashboards for specific use cases
2. **Alert Rules**: Set up alerts for critical metrics
3. **Performance Baselines**: Establish performance baselines
4. **Capacity Planning**: Use metrics for capacity planning
5. **Integration**: Connect with external monitoring tools

---

**Need Help?** Check the logs or refer to the comprehensive documentation in `PHASE6_README.md` 