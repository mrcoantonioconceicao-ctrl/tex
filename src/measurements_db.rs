//! Testes, condições e medições das tabelas do PSI, lidos do PostgreSQL
//! (experimental_runs, experiment_conditions e measurements, gravados por
//! `npm run normalize:psi`). Serve GET /investigations/{accession}/runs e
//! GET /conditions/coverage (docs/api-spec.yaml).
//!
//! Mesmas convenções do catalog_db.rs: NUMERIC sai do SQL como float8 e datas como
//! texto; o raw JSONB sai como texto e vira JSON aqui (sqlx sem a feature json).

use std::collections::HashMap;

use serde::Serialize;
use sqlx::postgres::{PgConnection, PgRow};
use sqlx::Row;
use thiserror::Error;

use crate::domain::combustion::psi_dto::Program;
use crate::lineage::OriginCategory;

#[derive(Debug, Error)]
pub enum MeasurementsDbError {
    #[error("consulta de medições falhou: {0}")]
    Query(#[from] sqlx::Error),
    #[error("{record}: {field} fora do contrato ({value})")]
    InvalidRow {
        record: String,
        field: &'static str,
        value: String,
    },
}

// ---- Respostas (schemas do contrato) ----

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Measurement {
    pub variable: String,
    pub value: Option<f64>,
    pub unit: String,
    pub elapsed_time_seconds: Option<f64>,
    pub quality_status: String,
    pub origin_category: OriginCategory,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct TestConditions {
    pub o2_percent: Option<f64>,
    pub pressure_atm: Option<f64>,
    pub flow_velocity_ms: Option<f64>,
    pub diluent: Option<String>,
    pub flow_direction: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SourceFile {
    pub file_name: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ExperimentalRun {
    pub test_label: String,
    pub run_date: Option<String>,
    pub sample_description: Option<String>,
    pub outcome: Option<String>,
    pub conditions: Option<TestConditions>,
    pub measurements: Vec<Measurement>,
    pub source_file: SourceFile,
    pub raw: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct VariableSummary {
    pub variable: String,
    pub unit: String,
    pub count: i64,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub pending_count: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct RunPage {
    pub accession: String,
    pub items: Vec<ExperimentalRun>,
    pub total: i64,
    pub page: usize,
    pub page_size: usize,
    pub variables: Vec<VariableSummary>,
}

impl RunPage {
    /// Investigação sem tabela normalizada (ex.: catálogo sintético)
    pub fn empty(accession: &str, page: usize, page_size: usize) -> Self {
        Self {
            accession: accession.to_string(),
            items: Vec::new(),
            total: 0,
            page,
            page_size,
            variables: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
pub struct NumberRange {
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ConditionCoverage {
    pub accession: String,
    pub name: String,
    pub program: Program,
    pub run_count: i64,
    pub o2_percent: Option<NumberRange>,
    pub pressure_atm: Option<NumberRange>,
    pub flow_velocity_ms: Option<NumberRange>,
    pub diluents: Vec<String>,
    pub flow_directions: Vec<String>,
    pub matching_runs: Option<i64>,
    pub origin_category: OriginCategory,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ConditionCoverageList {
    pub items: Vec<ConditionCoverage>,
}

/// Envelope de /conditions/coverage; tudo None = sem filtro (matching_runs null)
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Envelope {
    pub o2_min: Option<f64>,
    pub o2_max: Option<f64>,
    pub pressure_min_atm: Option<f64>,
    pub pressure_max_atm: Option<f64>,
    pub flow_min_ms: Option<f64>,
    pub flow_max_ms: Option<f64>,
}

impl Envelope {
    pub fn is_empty(&self) -> bool {
        *self == Self::default()
    }
}

// ---- Consultas ----

const EXPERIMENT_SQL: &str = "SELECT experiment_id FROM experiments WHERE psi_accession = $1";

const RUN_COUNT_SQL: &str = r#"
SELECT count(*) AS total
  FROM experimental_runs
 WHERE experiment_id = $1 AND source_file_id IS NOT NULL
"#;

/// Ordem da tabela de origem: arquivo, depois a ordem de gravação (run_id).
/// Uma condição por teste (a primeira gravada).
const RUNS_SQL: &str = r#"
SELECT r.run_id, coalesce(r.test_label, 'registro ' || r.run_id) AS test_label,
       to_char(r.run_date, 'YYYY-MM-DD') AS run_date,
       r.sample_description, r.outcome, r.raw::text AS raw, f.file_name, f.sha256,
       c.run_id IS NOT NULL AS has_condition,
       c.o2_concentration::float8 AS o2, c.pressure_atm::float8 AS pressure,
       c.flow_velocity_ms::float8 AS flow, c.diluent, c.flow_direction
  FROM experimental_runs r
  JOIN experiment_files f ON f.file_id = r.source_file_id
  LEFT JOIN LATERAL (
        SELECT * FROM experiment_conditions ec
         WHERE ec.run_id = r.run_id
         ORDER BY ec.condition_id
         LIMIT 1) c ON true
 WHERE r.experiment_id = $1
 ORDER BY f.file_name, r.run_id
 LIMIT $2 OFFSET $3
"#;

const MEASUREMENTS_SQL: &str = r#"
SELECT run_id, variable, value, unit, elapsed_time_seconds, quality_status, origin_category
  FROM measurements
 WHERE run_id = ANY($1) AND ($2::text IS NULL OR variable = $2)
 ORDER BY run_id, measurement_id
"#;

/// Investigação inteira, não só a página
const VARIABLES_SQL: &str = r#"
SELECT m.variable, m.unit, count(*) AS count, min(m.value) AS min, max(m.value) AS max,
       count(*) FILTER (WHERE m.quality_status = 'PENDING_VALIDATION') AS pending_count
  FROM measurements m
  JOIN experimental_runs r USING (run_id)
 WHERE r.experiment_id = $1 AND r.source_file_id IS NOT NULL
 GROUP BY m.variable, m.unit
 ORDER BY m.variable, m.unit
"#;

/// Teste sem valor numa dimensão filtrada não conta: NULL >= x é NULL, não true
const COVERAGE_SQL: &str = r#"
SELECT e.psi_accession, e.name, e.program, e.origin_category,
       count(*) AS run_count,
       min(c.o2_concentration)::float8 AS o2_min, max(c.o2_concentration)::float8 AS o2_max,
       min(c.pressure_atm)::float8 AS pressure_min, max(c.pressure_atm)::float8 AS pressure_max,
       min(c.flow_velocity_ms)::float8 AS flow_min, max(c.flow_velocity_ms)::float8 AS flow_max,
       coalesce(array_agg(DISTINCT c.diluent ORDER BY c.diluent)
                FILTER (WHERE c.diluent IS NOT NULL), '{}') AS diluents,
       coalesce(array_agg(DISTINCT c.flow_direction ORDER BY c.flow_direction)
                FILTER (WHERE c.flow_direction IS NOT NULL), '{}') AS flow_directions,
       count(*) FILTER (WHERE
             ($1::float8 IS NULL OR c.o2_concentration >= $1)
         AND ($2::float8 IS NULL OR c.o2_concentration <= $2)
         AND ($3::float8 IS NULL OR c.pressure_atm >= $3)
         AND ($4::float8 IS NULL OR c.pressure_atm <= $4)
         AND ($5::float8 IS NULL OR c.flow_velocity_ms >= $5)
         AND ($6::float8 IS NULL OR c.flow_velocity_ms <= $6)) AS matching
  FROM experimental_runs r
  JOIN experiments e USING (experiment_id)
  LEFT JOIN LATERAL (
        SELECT * FROM experiment_conditions ec
         WHERE ec.run_id = r.run_id
         ORDER BY ec.condition_id
         LIMIT 1) c ON true
 WHERE r.source_file_id IS NOT NULL AND e.psi_accession IS NOT NULL
 GROUP BY e.experiment_id, e.psi_accession, e.name, e.program, e.origin_category
 ORDER BY substring(e.psi_accession FROM 5)::numeric
"#;

/// None = nenhuma investigação com esse código (404)
pub async fn load_runs(
    conn: &mut PgConnection,
    accession: &str,
    variable: Option<&str>,
    page: usize,
    page_size: usize,
) -> Result<Option<RunPage>, MeasurementsDbError> {
    let Some(row) = sqlx::query(EXPERIMENT_SQL)
        .bind(accession)
        .fetch_optional(&mut *conn)
        .await?
    else {
        return Ok(None);
    };
    let experiment_id: i64 = row.try_get("experiment_id")?;
    let total: i64 = sqlx::query(RUN_COUNT_SQL)
        .bind(experiment_id)
        .fetch_one(&mut *conn)
        .await?
        .try_get("total")?;

    // Página além do fim: lista vazia, como no catálogo
    let limit = i64::try_from(page_size).unwrap_or(i64::MAX);
    let offset = page
        .saturating_sub(1)
        .saturating_mul(page_size)
        .try_into()
        .unwrap_or(i64::MAX);
    let run_rows = sqlx::query(RUNS_SQL)
        .bind(experiment_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&mut *conn)
        .await?;
    let run_ids = run_rows
        .iter()
        .map(|row| row.try_get::<i64, _>("run_id"))
        .collect::<Result<Vec<_>, _>>()?;
    let measurement_rows = sqlx::query(MEASUREMENTS_SQL)
        .bind(&run_ids)
        .bind(variable)
        .fetch_all(&mut *conn)
        .await?;
    let mut measurements = group_measurements(&measurement_rows, accession)?;

    let items = run_rows
        .iter()
        .map(|row| {
            let run_id: i64 = row.try_get("run_id")?;
            to_run(
                row,
                measurements.remove(&run_id).unwrap_or_default(),
                accession,
            )
        })
        .collect::<Result<Vec<_>, _>>()?;
    let variable_rows = sqlx::query(VARIABLES_SQL)
        .bind(experiment_id)
        .fetch_all(&mut *conn)
        .await?;
    let variables = variable_rows
        .iter()
        .map(to_variable_summary)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Some(RunPage {
        accession: accession.to_string(),
        items,
        total,
        page,
        page_size,
        variables,
    }))
}

pub async fn load_coverage(
    conn: &mut PgConnection,
    envelope: &Envelope,
) -> Result<ConditionCoverageList, MeasurementsDbError> {
    let rows = sqlx::query(COVERAGE_SQL)
        .bind(envelope.o2_min)
        .bind(envelope.o2_max)
        .bind(envelope.pressure_min_atm)
        .bind(envelope.pressure_max_atm)
        .bind(envelope.flow_min_ms)
        .bind(envelope.flow_max_ms)
        .fetch_all(&mut *conn)
        .await?;
    let items = rows
        .iter()
        .map(|row| to_coverage(row, envelope))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ConditionCoverageList { items })
}

// ---- Linhas -> respostas ----

fn origin(row: &PgRow, record: &str) -> Result<OriginCategory, MeasurementsDbError> {
    let raw: String = row.try_get("origin_category")?;
    OriginCategory::parse(&raw).ok_or_else(|| invalid(record, "origin_category", &raw))
}

fn group_measurements(
    rows: &[PgRow],
    accession: &str,
) -> Result<HashMap<i64, Vec<Measurement>>, MeasurementsDbError> {
    let mut grouped: HashMap<i64, Vec<Measurement>> = HashMap::new();
    for row in rows {
        let measurement = Measurement {
            variable: row.try_get("variable")?,
            value: row.try_get("value")?,
            unit: row.try_get("unit")?,
            elapsed_time_seconds: row.try_get("elapsed_time_seconds")?,
            quality_status: row.try_get("quality_status")?,
            origin_category: origin(row, accession)?,
        };
        let run_id: i64 = row.try_get("run_id")?;
        grouped.entry(run_id).or_default().push(measurement);
    }
    Ok(grouped)
}

fn to_run(
    row: &PgRow,
    measurements: Vec<Measurement>,
    accession: &str,
) -> Result<ExperimentalRun, MeasurementsDbError> {
    let raw_text: String = row.try_get("raw")?;
    let raw =
        serde_json::from_str(&raw_text).map_err(|_| invalid(accession, "raw", "JSON inválido"))?;
    let has_condition: bool = row.try_get("has_condition")?;
    let conditions = if has_condition {
        Some(TestConditions {
            o2_percent: row.try_get("o2")?,
            pressure_atm: row.try_get("pressure")?,
            flow_velocity_ms: row.try_get("flow")?,
            diluent: row.try_get("diluent")?,
            flow_direction: row.try_get("flow_direction")?,
        })
    } else {
        None
    };
    // Teste normalizado só existe para arquivo baixado e conferido: sem hash é dado fora do contrato
    let sha256: Option<String> = row.try_get("sha256")?;
    let sha256 = sha256.ok_or_else(|| invalid(accession, "sha256", "nulo"))?;
    Ok(ExperimentalRun {
        test_label: row.try_get("test_label")?,
        run_date: row.try_get("run_date")?,
        sample_description: row.try_get("sample_description")?,
        outcome: row.try_get("outcome")?,
        conditions,
        measurements,
        source_file: SourceFile {
            file_name: row.try_get("file_name")?,
            sha256,
        },
        raw,
    })
}

fn to_variable_summary(row: &PgRow) -> Result<VariableSummary, MeasurementsDbError> {
    Ok(VariableSummary {
        variable: row.try_get("variable")?,
        unit: row.try_get("unit")?,
        count: row.try_get("count")?,
        min: row.try_get("min")?,
        max: row.try_get("max")?,
        pending_count: row.try_get("pending_count")?,
    })
}

fn range(row: &PgRow, min: &str, max: &str) -> Result<Option<NumberRange>, MeasurementsDbError> {
    let min: Option<f64> = row.try_get(min)?;
    let max: Option<f64> = row.try_get(max)?;
    Ok(min.zip(max).map(|(min, max)| NumberRange { min, max }))
}

fn to_coverage(row: &PgRow, envelope: &Envelope) -> Result<ConditionCoverage, MeasurementsDbError> {
    let accession: String = row.try_get("psi_accession")?;
    let program: String = row.try_get("program")?;
    let program =
        Program::parse(&program).ok_or_else(|| invalid(&accession, "program", &program))?;
    let matching: i64 = row.try_get("matching")?;
    Ok(ConditionCoverage {
        name: row.try_get("name")?,
        program,
        run_count: row.try_get("run_count")?,
        o2_percent: range(row, "o2_min", "o2_max")?,
        pressure_atm: range(row, "pressure_min", "pressure_max")?,
        flow_velocity_ms: range(row, "flow_min", "flow_max")?,
        diluents: row.try_get("diluents")?,
        flow_directions: row.try_get("flow_directions")?,
        matching_runs: (!envelope.is_empty()).then_some(matching),
        origin_category: origin(row, &accession)?,
        accession,
    })
}

fn invalid(record: &str, field: &'static str, value: impl ToString) -> MeasurementsDbError {
    MeasurementsDbError::InvalidRow {
        record: record.to_string(),
        field,
        value: value.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use sqlx::Connection;

    use super::*;

    // Uma investigação sintética (código fora da faixa do PSI real, Synthetic) com
    // uma tabela de 3 testes. A transação é desfeita no fim do teste.
    const SEED_SQL: &str = r#"
WITH e AS (
  INSERT INTO experiments (name, program, psi_accession, raw, origin_category)
  VALUES ('Tex teste sintético PSI-100001', 'BASS', 'PSI-100001', '{"synthetic": true}', 'Synthetic')
  RETURNING experiment_id
), f AS (
  INSERT INTO experiment_files (experiment_id, category, file_name, sha256)
  SELECT experiment_id, 'Experimental table', 'sintetico.csv', repeat('a', 64) FROM e
  RETURNING file_id, experiment_id
), r AS (
  INSERT INTO experimental_runs (experiment_id, run_date, test_label, source_file_id, raw)
  SELECT f.experiment_id, v.d, v.l, f.file_id, jsonb_build_object('Test #', v.l)
    FROM f, (VALUES ('T1', DATE '2014-02-19'), ('T2', NULL), ('T3', NULL)) AS v (l, d)
  RETURNING run_id, test_label, source_file_id
), c AS (
  INSERT INTO experiment_conditions (run_id, o2_concentration, pressure_atm, diluent, flow_direction)
  SELECT r.run_id, v.o2, v.p, 'N2', 'opposed'
    FROM r JOIN (VALUES ('T1', 21.0, 1.0), ('T2', 35.0, 0.6)) AS v (l, o2, p) ON v.l = r.test_label
)
INSERT INTO measurements (run_id, variable, value, unit, quality_status, origin_category, source_file_id)
SELECT r.run_id, v.var, v.val, '%', v.q, 'Synthetic', r.source_file_id
  FROM r JOIN (VALUES ('T1', 'o2_initial', 21.0, 'EXTRACTED'),
                      ('T1', 'o2_final', 20.5, 'EXTRACTED'),
                      ('T2', 'o2_final', 1.6, 'PENDING_VALIDATION')) AS v (l, var, val, q)
    ON v.l = r.test_label
"#;

    // Só roda com um Postgres migrado (Backend CI ou make up), ex.:
    //   TEX_TEST_DATABASE_URL=postgres://tex:tex@127.0.0.1:5433/tex cargo test
    #[tokio::test]
    async fn le_testes_condicoes_medicoes_e_cobertura_do_banco() {
        let Ok(url) = std::env::var("TEX_TEST_DATABASE_URL") else {
            eprintln!("TEX_TEST_DATABASE_URL não definida; teste do banco pulado");
            return;
        };
        let mut conn = PgConnection::connect(&url).await.unwrap();
        let mut tx = conn.begin().await.unwrap();
        sqlx::query(SEED_SQL).execute(&mut *tx).await.unwrap();

        let page = load_runs(&mut tx, "PSI-100001", None, 1, 2)
            .await
            .unwrap()
            .unwrap();
        let filtered = load_runs(&mut tx, "PSI-100001", Some("o2_final"), 1, 10)
            .await
            .unwrap()
            .unwrap();
        let missing = load_runs(&mut tx, "PSI-100002", None, 1, 10).await.unwrap();
        let all = load_coverage(&mut tx, &Envelope::default()).await.unwrap();
        let lunar = Envelope {
            o2_min: Some(30.0),
            pressure_max_atm: Some(0.694),
            ..Envelope::default()
        };
        let lunar = load_coverage(&mut tx, &lunar).await.unwrap();
        tx.rollback().await.unwrap();

        assert!(missing.is_none());
        assert_eq!(page.total, 3);
        assert_eq!(page.items.len(), 2);
        let first = &page.items[0];
        assert_eq!(first.test_label, "T1");
        assert_eq!(first.run_date.as_deref(), Some("2014-02-19"));
        assert_eq!(first.raw, serde_json::json!({ "Test #": "T1" }));
        assert_eq!(first.source_file.file_name, "sintetico.csv");
        assert_eq!(first.measurements.len(), 2);
        assert_eq!(
            first.measurements[0].origin_category,
            OriginCategory::Synthetic
        );
        let conditions = first.conditions.as_ref().unwrap();
        assert_eq!(conditions.o2_percent, Some(21.0));
        assert_eq!(conditions.diluent.as_deref(), Some("N2"));
        // Resumo das variáveis cobre a investigação inteira
        let o2_final = page
            .variables
            .iter()
            .find(|v| v.variable == "o2_final")
            .unwrap();
        assert_eq!((o2_final.count, o2_final.pending_count), (2, 1));
        assert_eq!((o2_final.min, o2_final.max), (Some(1.6), Some(20.5)));

        // Filtro por variável mantém todos os testes
        assert_eq!(filtered.items.len(), 3);
        assert_eq!(filtered.items[0].measurements.len(), 1);
        assert!(filtered.items[2].measurements.is_empty());
        assert!(filtered.items[2].conditions.is_none());

        let find = |list: &ConditionCoverageList| {
            list.items
                .iter()
                .find(|item| item.accession == "PSI-100001")
                .cloned()
                .unwrap()
        };
        let coverage = find(&all);
        assert_eq!(coverage.run_count, 3);
        assert_eq!(
            coverage.o2_percent,
            Some(NumberRange {
                min: 21.0,
                max: 35.0
            })
        );
        assert_eq!(coverage.flow_velocity_ms, None);
        assert_eq!(coverage.diluents, ["N2"]);
        assert_eq!(coverage.matching_runs, None);
        // Só o T2 (35% de O₂, 0,6 atm) cai no envelope lunar
        assert_eq!(find(&lunar).matching_runs, Some(1));
    }
}
