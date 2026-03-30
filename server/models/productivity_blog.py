from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.sql.expression import column

from core.database import Base

productivity_blog_post_categories = Table(
    "productivity_blog_post_categories",
    Base.metadata,
    Column(
        "post_id",
        Integer,
        ForeignKey("productivity_blog_posts.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "category_id",
        Integer,
        ForeignKey("productivity_blog_categories.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class ProductivityBlogCategory(Base):
    __tablename__ = "productivity_blog_categories"
    __table_args__ = (
        Index(
            "uq_productivity_blog_categories_user_lower_name",
            "user_id",
            func.lower(column("name")),
            unique=True,
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(256), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    posts = relationship(
        "ProductivityBlogPost",
        secondary=productivity_blog_post_categories,
        back_populates="categories",
    )


class ProductivityBlogPost(Base):
    __tablename__ = "productivity_blog_posts"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "client_post_id",
            name="uq_productivity_blog_posts_user_client_id",
        ),
        Index(
            "uq_productivity_blog_posts_user_lower_title",
            "user_id",
            func.lower(column("title")),
            unique=True,
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_post_id = Column(String(64), nullable=False)
    title = Column(String(512), nullable=False)
    body_html = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    categories = relationship(
        "ProductivityBlogCategory",
        secondary=productivity_blog_post_categories,
        back_populates="posts",
    )
